import os
import pandas as pd
import numpy as np
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
import joblib
import logging
from utils.feature_extraction import extract_features

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

MODEL_PATH = "svm_model.pkl"

def load_csv_files(directory):
    X = []
    y = []
    for root, subdirs, files in os.walk(directory):  # Traverse all subdirectories
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

                        # Log the DataFrame structure for debugging
                        logging.debug(f"Processing file: {filename} in folder: {subdir}")
                        logging.debug(f"DataFrame columns: {df.columns}")
                        logging.debug(f"DataFrame head:\n{df.head()}")

                        # Ensure the DataFrame has the expected columns
                        if df.shape[1] >= 8:  # Check if there are at least 8 columns
                            df.columns = ["time_acc", "acc_x", "acc_y", "acc_z", "time_gyro", "gyro_x", "gyro_y", "gyro_z"]

                            if not df.empty:
                                features = extract_features(df)

                                # Log extracted features
                                logging.debug(f"Extracted features for {filename}: {features}")

                                X.append(features)
                                y.append(label)
                            else:
                                logging.warning(f"File {filename} in folder {subdir} is empty. Skipping.")
                        else:
                            logging.error(f"File {filename} does not have the required columns. Skipping.")
            else:
                logging.warning(f"Subdirectory {subdir} does not match expected patterns (_L_, _O_, _S_). Skipping.")

    if len(X) == 0:
        logging.error("No valid data found in the directory. Ensure the files are correctly formatted and not empty.")
        raise ValueError("No valid data found in the directory.")

    return np.array(X), np.array(y)

def train_model(data_dir):
    X, y = load_csv_files(data_dir)

    # Log dataset size
    logging.info(f"Training dataset size: {len(X)} samples")

    clf = make_pipeline(StandardScaler(), SVC(kernel='linear'))
    clf.fit(X, y)

    # Log model training completion
    logging.info("Model training completed. Saving model...")

    joblib.dump(clf, MODEL_PATH)
    logging.info(f"Model saved to {MODEL_PATH}")

def load_model_and_predict(feature_dict):
    clf = joblib.load(MODEL_PATH)
    x_input = np.array([list(feature_dict.values())]).reshape(1, -1)
    prediction = clf.predict(x_input)[0]
    label_map = {0: "walk", 1: "run", 2: "stair up"}
    return label_map[prediction]
