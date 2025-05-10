from flask import Flask, request, jsonify
from train_model import train_model, extract_features
import os
import pandas as pd
import numpy as np
import joblib
import logging  # Add logging for debugging
import matplotlib.pyplot as plt

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

MODEL_PATH = "svm_model.pkl"
TRAIN_FOLDER = "dataset"

# Moved route definitions to separate files in the `routes` folder
from routes.test_routes import test_routes
from routes.evaluate_routes import evaluate_routes

# Register blueprints for routes
app.register_blueprint(test_routes, url_prefix='/test')
app.register_blueprint(evaluate_routes, url_prefix='/evaluate')

# Predict endpoint
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    try:
        features = [
            data["feature1"], data["feature2"], data["feature3"],
            data["feature4"], data["feature5"], data["feature6"],
            data["feature7"], data["feature8"], data["feature9"],
            data["feature10"], data["feature11"], data["feature12"],
            data["feature13"], data["feature14"], data["feature15"],
            data["feature16"]
        ]
        clf = joblib.load(MODEL_PATH)
        prediction = clf.predict([features])[0]
        return jsonify({"prediction": prediction})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Train endpoint
@app.route("/train", methods=["POST"])
def train():
    try:
        train_model(TRAIN_FOLDER)
        return jsonify({"status": "Model trained and saved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
