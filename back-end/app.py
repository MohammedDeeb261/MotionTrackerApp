from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/")
def health():
    return "Server is running."

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    # TODO: Replace with your ML model
    print("Received features:", data)

    # Dummy prediction (replace with model later)
    return jsonify({ "activity": "walking" })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
