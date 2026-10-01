"""Small upload page: Health Only PDF plus one background, print PDF back."""

from __future__ import annotations

import io

from flask import Flask, render_template, request, send_file

from dmg_app.render import build_pdf

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 40 * 1024 * 1024


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/generate")
def generate():
    pdf = request.files.get("pdf")
    image = request.files.get("image")
    paper = request.form.get("paper") or "a4"
    if paper not in {"a4", "letter"}:
        paper = "a4"
    if pdf is None or not pdf.filename:
        return render_template("index.html", error="Wybierz PDF Health Only."), 400
    if image is None or not image.filename:
        return render_template("index.html", error="Wybierz obrazek tła."), 400
    try:
        payload, _analysis = build_pdf(pdf.read(), image.read(), paper=paper)
    except ValueError as exc:
        return render_template("index.html", error=str(exc)), 400
    except Exception:
        return render_template(
            "index.html",
            error="Nie udało się odczytać tego PDF albo obrazka. Sprawdź pliki i spróbuj jeszcze raz.",
        ), 400
    return send_file(
        io.BytesIO(payload),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="siatki-obrazen.pdf",
    )


def main() -> None:
    app.run(host="0.0.0.0", port=8741, debug=False)


if __name__ == "__main__":
    main()
