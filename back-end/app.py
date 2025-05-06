from flask import Flask, request, jsonify
from train_model import train_model, load_model_and_predict

app = Flask(__name__)

@app.route('/train', methods=['POST'])
def train():
    train_model('backend/dataset')  # This is where your CSV files are stored
    return jsonify({"status": "Model trained and saved"})

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    prediction = load_model_and_predict(data)
    return jsonify({"prediction": prediction})
