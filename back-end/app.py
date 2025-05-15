from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model

app = Flask(__name__)
CORS(app)

MODEL_PATH = 'cnn_motion_model.h5'
CLASSES = ['walk', 'stand', 'run']
WINDOW_SIZE = 100
N_CHANNELS = 6

model = load_model(MODEL_PATH)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data or 'window' not in data:
        return jsonify({'error': 'Missing window data'}), 400
    window = data['window']
    # window should be a list of 100 samples, each sample is a list of 6 values
    try:
        arr = np.array(window)
        if arr.shape != (WINDOW_SIZE, N_CHANNELS):
            return jsonify({'error': f'Input shape must be (100, 6), got {arr.shape}'}), 400
        arr = arr.reshape(1, WINDOW_SIZE, N_CHANNELS)
        pred = model.predict(arr)
        pred_class = int(np.argmax(pred))
        pred_label = CLASSES[pred_class]
        return jsonify({'prediction': pred_label, 'probabilities': pred[0].tolist()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return 'Motion CNN API is running.'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
