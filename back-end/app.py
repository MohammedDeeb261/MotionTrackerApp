from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import os
import json
import hashlib
import time
from tensorflow.keras.models import load_model
from supabase import create_client
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Load environment variables
load_dotenv()
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MODEL_PATH = 'cnn_motion_model.keras'
TRAIN_DATA_DIR = 'data/train'
WINDOW_SIZE = 100
N_CHANNELS = 6

# Supabase already provides auth.users table by default
# We'll use the Supabase auth API for signup and login
print("Using Supabase's built-in authentication system")

# Always load class labels from class_labels.json for consistent mapping
with open('class_labels.json', 'r') as f:
    CLASSES = json.load(f)

model = load_model(MODEL_PATH)

@app.route('/predict', methods=['POST'])
def predict():
    print('--- /predict called ---')
    try:
        data = request.get_json(force=True, silent=True)
    except Exception as e:
        return jsonify({'error': 'Invalid JSON', 'details': str(e)}), 400
    if not data or 'window' not in data:
        return jsonify({'error': 'Missing window data'}), 400
    window = data['window']
    try:
        arr = np.array(window)
        if arr.shape != (WINDOW_SIZE, N_CHANNELS):
            return jsonify({'error': f'Input shape must be (100, 6), got {arr.shape}'}), 400
        arr = arr.reshape(1, WINDOW_SIZE, N_CHANNELS)
        pred = model.predict(arr)
        pred_class = int(np.argmax(pred))
        pred_label = CLASSES[pred_class]
        confidence = float(np.max(pred))
        print('Prediction:', pred_label)
        print('Confidence:', confidence)
        return jsonify({'prediction': pred_label, 'confidence': confidence, 'probabilities': pred[0].tolist()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json(force=True, silent=True)
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    try:
        # Use Supabase auth API to sign up
        response = supabase.auth.sign_up({
            "email": username,
            "password": password,
        })
        
        # Check if signup was successful
        if response.user and response.user.id:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Signup failed'}), 400
    except Exception as e:
        print(f"Signup error: {str(e)}")
        # Check for user already exists
        if "user already registered" in str(e).lower():
            return jsonify({'success': False, 'message': 'User already exists'}), 409
        return jsonify({'success': False, 'message': f'Authentication error: {str(e)}'}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(force=True, silent=True)
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    try:
        # Use Supabase auth API to sign in with password
        response = supabase.auth.sign_in_with_password({
            "email": username,
            "password": password
        })
        
        # Get token from response
        if response.session and response.session.access_token:
            return jsonify({
                'success': True, 
                'token': response.session.access_token,
                'user': {
                    'id': response.user.id,
                    'email': response.user.email
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Login failed'}), 401
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'success': False, 'message': 'Invalid email or password'}), 401

@app.route('/', methods=['GET', 'OPTIONS'])
def index():
    if request.method == 'OPTIONS':
        return '', 200
    return 'Motion CNN API is running.', 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
