from flask import Flask, request, jsonify
from train_model import train_model
app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    # run your model here (mocked below)
    prediction = "running"
    return jsonify({"prediction": prediction})


@app.route('/train', methods=['POST'])
def train():
    train_model("backend/dataset")  # Points to the folder where CSVs are
    return jsonify({"status": "Model trained and saved"})
