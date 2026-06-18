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
    from blueprints.uploads import bp as uploads_bp

    app.register_blueprint(assessments_bp)
    app.register_blueprint(service_members_bp)
    app.register_blueprint(units_bp)
    app.register_blueprint(readiness_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(uploads_bp)

    @app.get("/api/health")
    def health() -> Response:
        return jsonify({"status": "ok", "service": "drp-backend"})

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
