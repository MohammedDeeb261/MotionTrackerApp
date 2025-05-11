from flask import Flask, request, jsonify
from train_model import train_model, extract_features
import os
import pandas as pd
import numpy as np
import joblib
import logging  # Add logging for debugging
import matplotlib.pyplot as plt
from utils.feature_extraction import extract_features

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

MODEL_PATH = "svm_model.pkl"
TRAIN_FOLDER = "training_windows"

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
        # Wrap each scalar value in a list to satisfy DataFrame constructor
        data = {key: [value] for key, value in data.items()}

        # Convert to DataFrame
        df = pd.DataFrame(data)

        # Call the extract_features function to generate the features
        features = extract_features(df)
        
        # Load the model and make the prediction
        clf = joblib.load(MODEL_PATH)
        prediction = clf.predict([features])[0]

        # Map the prediction to the activity label
        label_map = {0: "walk", 1: "run", 2: "stair up"}
        
        return jsonify({"prediction": label_map[prediction]})

    except Exception as e:
        logging.error(f"Prediction error: {e}")
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
