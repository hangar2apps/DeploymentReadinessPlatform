"""
DRP Flask backend — application factory and entry point.

Mirrors the Express gateway's role from CLAUDE_CODE_BUILD.md: it serves the REST API for the three user surfaces (service member, provider, commander) and runs the policy assistant's RAG pipeline in-process (see rag.py).

Run locally:
    cd backend
    pip install -r requirements.txt
    python app.py            # -> http://localhost:3000
"""

from flask import Flask, jsonify
from flask.wrappers import Response
from flask_cors import CORS

import config


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, origins=[config.FRONTEND_ORIGIN])

    # Register resource blueprints. Imported here so create_app stays the one place that wires routes together.
    from blueprints.assessments import bp as assessments_bp
    from blueprints.service_members import bp as service_members_bp
    from blueprints.units import bp as units_bp
    from blueprints.readiness import bp as readiness_bp
    from blueprints.chat import bp as chat_bp
    from blueprints.documents import bp as documents_bp

    app.register_blueprint(assessments_bp)
    app.register_blueprint(service_members_bp)
    app.register_blueprint(units_bp)
    app.register_blueprint(readiness_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(documents_bp)

    @app.get("/api/health")
    def health() -> Response:
        return jsonify({"status": "ok", "service": "drp-backend"})

    return app


app = create_app()


if __name__ == "__main__":
    # TODO Disable debug mode
    app.run(
        host="0.0.0.0",
        port=config.PORT,
        debug=True,
    )
