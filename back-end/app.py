from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    # run your model here (mocked below)
    prediction = "running"
    return jsonify({"prediction": prediction})
