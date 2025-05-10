import os
import pandas as pd
import numpy as np
import joblib
import logging
from train_model import extract_features  # reuse feature extraction logic
from services.evaluation_service import evaluate_model

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Path to your trained model
MODEL_PATH = "svm_model.pkl"

# Folder containing test CSV files
TEST_FOLDER = "test_dataset"  

# Mapping of label code in filename to activity label (adjust as needed)
label_map = {
    "L": "walk",
    "O": "run",
    "S": "stair up"
}

def get_true_label(filename):
    """
    Extract activity label code from filename and map it to an integer class.
    """
    activity_map = {
        'L': 0,  # walk
        'O': 1,  # run
        'S': 2   # stair up
    }

    parts = filename.split('_')
    if len(parts) < 2:
        return -1

    code = parts[1]  # Extracts 'L', 'O', or 'S'
    return activity_map.get(code, -1)

if __name__ == "__main__":
    evaluate_model(TEST_FOLDER)
