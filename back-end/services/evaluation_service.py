import os
import pandas as pd
import numpy as np
import joblib
from utils.feature_extraction import extract_features

MODEL_PATH = "svm_model.pkl"

def evaluate_model(data_folder):
    clf = joblib.load(MODEL_PATH)
    activity_counts = {"walk": {"passed": 0, "total": 0}, "run": {"passed": 0, "total": 0}, "stair up": {"passed": 0, "total": 0}}

    label_map = {0: "walk", 1: "run", 2: "stair up"}

    for subdir in os.listdir(data_folder):
        subdir_path = os.path.join(data_folder, subdir)
        if os.path.isdir(subdir_path):
            true_label = get_true_label(subdir)
            predictions = []

            for filename in os.listdir(subdir_path):
                if filename.startswith("window_") and filename.endswith(".csv"):
                    path = os.path.join(subdir_path, filename)
                    df = pd.read_csv(path, header=None)
                    df.columns = ["time_acc", "acc_x", "acc_y", "acc_z", "time_gyro", "gyro_x", "gyro_y", "gyro_z"]

                    features = extract_features(df)
                    pred = clf.predict([features])[0]
                    predictions.append(pred)

            # Perform voting to determine the final predicted activity for the folder
            if predictions:
                final_pred = max(set(predictions), key=predictions.count)
                predicted_activity = label_map.get(final_pred, "unknown")
                true_activity = label_map.get(true_label, "unknown")

                if true_activity in activity_counts:
                    activity_counts[true_activity]["total"] += 1
                    if predicted_activity == true_activity:
                        activity_counts[true_activity]["passed"] += 1

    return activity_counts

def get_true_label(filename):
    if "_L_" in filename:
        return 0  # walk
    elif "_O_" in filename:
        return 1  # run
    elif "_S_" in filename:
        return 2  # stair up
    return -1