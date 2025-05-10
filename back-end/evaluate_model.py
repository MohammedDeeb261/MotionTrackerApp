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

def evaluate_model(data_dir):
    clf = joblib.load(MODEL_PATH)
    activity_counts = {"walk": {"passed": 0, "total": 0}, "run": {"passed": 0, "total": 0}, "stair up": {"passed": 0, "total": 0}}

    label_map = {0: "walk", 1: "run", 2: "stair up"}

    for root, subdirs, files in os.walk(data_dir):  # Traverse all subdirectories
        for subdir in subdirs:  # Process each subdirectory (e.g., 002_L_3)
            label = None
            if "_L_" in subdir:
                label = 0  # walk
            elif "_O_" in subdir:
                label = 1  # run
            elif "_S_" in subdir:
                label = 2  # stair up

            if label is not None:
                subdir_path = os.path.join(root, subdir)
                for filename in os.listdir(subdir_path):
                    if filename.startswith("window_") and filename.endswith(".csv"):
                        path = os.path.join(subdir_path, filename)
                        df = pd.read_csv(path, header=None)
                        df.columns = ["time_acc", "acc_x", "acc_y", "acc_z", "time_gyro", "gyro_x", "gyro_y", "gyro_z"]

                        # Log the DataFrame structure for debugging
                        logging.debug(f"Processing file: {filename} in folder: {subdir}")
                        logging.debug(f"DataFrame head:\n{df.head()}")

                        features = extract_features(df)
                        pred = clf.predict([features])[0]

                        # Convert predicted and true labels to the same format (strings)
                        predicted_activity = label_map.get(pred, "unknown")
                        true_activity = label_map.get(label, "unknown")

                        if true_activity in activity_counts:
                            activity_counts[true_activity]["total"] += 1
                            if predicted_activity == true_activity:
                                activity_counts[true_activity]["passed"] += 1

    return activity_counts

if __name__ == "__main__":
    evaluate_model(TEST_FOLDER)
