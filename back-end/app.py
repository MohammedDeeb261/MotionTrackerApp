from flask import Flask, request, jsonify
from train_model import train_model
import joblib
import numpy as np

app = Flask(__name__)
MODEL_PATH = "svm_model.pkl"

@app.route("/train", methods=["POST"])
def train():
    train_model("back-end/dataset")
    return jsonify({"status": "Model trained and saved"})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    try:
        features = [data[key] for key in sorted(data)]
        model = joblib.load(MODEL_PATH)
        prediction = model.predict([features])[0]
        return jsonify({"prediction": prediction})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
