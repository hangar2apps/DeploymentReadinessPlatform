"""
DRP Flask backend — application factory and entry point.

Mirrors the Express gateway's role from CLAUDE_CODE_BUILD.md: it serves the REST API for the three user surfaces (service member, provider, commander) and runs the policy assistant's RAG pipeline in-process (see rag.py).

It also serves the built React SPA (frontend/dist, copied to backend/static in the container image) so the whole app ships as a single origin behind one UDS gateway exposure — see config.STATIC_DIR. In local dev the static dir is usually absent; run the Vite dev server separately and the SPA routes below simply 404.

Run locally:
    cd backend
    pip install -r requirements.txt
    python app.py            # -> http://localhost:3000
"""

import os

from flask import Flask, jsonify, send_from_directory
from flask.wrappers import Response
from flask_cors import CORS

import auth
import config


def create_app() -> Flask:
    # static_folder=None: we serve the SPA through the explicit catch-all route below rather than Flask's built-in static route, to avoid a clash between that route's `/<path:filename>` rule and our own catch-all.
    app = Flask(__name__, static_folder=None)
    # CORS is a no-op once the SPA is same-origin (served from this app), but it stays for local dev where the Vite dev server runs on a different port.
    CORS(app, origins=[config.FRONTEND_ORIGIN])

    # Register resource blueprints. Imported here so create_app stays the one place that wires routes together.
    from blueprints.assessments import bp as assessments_bp
    from blueprints.service_members import bp as service_members_bp
    from blueprints.units import bp as units_bp
    from blueprints.readiness import bp as readiness_bp
    from blueprints.chat import bp as chat_bp
    from blueprints.documents import bp as documents_bp
    from blueprints.notifications import bp as notifications_bp
    from blueprints.uploads import bp as uploads_bp

    app.register_blueprint(assessments_bp)
    app.register_blueprint(service_members_bp)
    app.register_blueprint(units_bp)
    app.register_blueprint(readiness_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(notifications_bp)

    if os.getenv("SCHEDULER_ENABLED", "").lower() == "true":
        import scheduler as _scheduler

        _scheduler.start()

    app.register_blueprint(uploads_bp)

    # Translate scope_unit's Forbidden into a 403 JSON response.
    auth.register_error_handlers(app)

    @app.get("/api/health")
    def health() -> Response:
        # Unauthenticated on purpose: the kubelet probes hit this before login.
        return jsonify({"status": "ok", "service": "drp-backend"})

    @app.get("/api/me")
    def me() -> Response:
        # Who the Authservice/Keycloak session resolves to. The SPA calls this on
        # load to learn its role + which seeded member/unit it operates as,
        # replacing the mock persona picker once real auth is in front.
        ident = auth.current_identity()
        if not ident.subject_present:
            return jsonify({"error": "authentication required"}), 401
        if not ident.roles:
            # Authenticated by Keycloak but the EDIPI has no roster row.
            return jsonify({"error": "forbidden: not a provisioned DRP user"}), 403
        return jsonify({
            "roles": sorted(ident.roles),
            "name": ident.name,
            "edipi": ident.edipi,
            "member_id": ident.member_id,
            "unit_id": ident.unit_id,
        })

    # --- SPA static serving + client-side-routing fallback ------------------
    # Replaces the standalone nginx container. Real files (JS/CSS/assets) are served as-is; any other path returns index.html so React Router can resolve it client-side — the equivalent of nginx `try_files ... /index.html`.
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa(path: str) -> Response:
        # API blueprints are matched ahead of this catch-all by Werkzeug, so a path that lands here under /api is genuinely unknown — don't mask it with index.html.
        if path.startswith("api/"):
            return jsonify({"error": "not found"}), 404

        file_path = os.path.join(config.STATIC_DIR, path)
        if path and os.path.isfile(file_path):
            return send_from_directory(config.STATIC_DIR, path)
        return send_from_directory(config.STATIC_DIR, "index.html")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=config.PORT,
    )
