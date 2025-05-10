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
        # Extract features from the incoming JSON data
        features = [
            data["acc_meanX"], data["acc_stdX"], data["acc_rmsX"], data["acc_maxX"], data["acc_minX"],
            data["acc_meanY"], data["acc_stdY"], data["acc_rmsY"], data["acc_maxY"], data["acc_minY"],
            data["acc_meanZ"], data["acc_stdZ"], data["acc_rmsZ"], data["acc_maxZ"], data["acc_minZ"],
            data["gyro_meanX"], data["gyro_stdX"], data["gyro_rmsX"], data["gyro_maxX"], data["gyro_minX"],
            data["gyro_meanY"], data["gyro_stdY"], data["gyro_rmsY"], data["gyro_maxY"], data["gyro_minY"],
            data["gyro_meanZ"], data["gyro_stdZ"], data["gyro_rmsZ"], data["gyro_maxZ"], data["gyro_minZ"],
            data["acc_sma"]
        ]
        clf = joblib.load(MODEL_PATH)
        prediction = clf.predict([features])[0]
        label_map = {0: "walk", 1: "run", 2: "stair up"}
        return jsonify({"prediction": label_map[prediction]})
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
