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
    for filename in os.listdir(directory):
        if filename.endswith(".csv"):
            label = None
            if "_L_" in filename:
                label = 0  # walk
            elif "_O_" in filename:
                label = 1  # run
            elif "_S_" in filename:
                label = 2  # stair up

            if label is not None:
                path = os.path.join(directory, filename)
                df = pd.read_csv(path, header=None)
                df.columns = ["time_acc", "acc_x", "acc_y", "acc_z", "time_gyro", "gyro_x", "gyro_y", "gyro_z"]

                # Log the DataFrame structure for debugging
                logging.debug(f"Processing file: {filename}")
                logging.debug(f"DataFrame head:\n{df.head()}")

                features = extract_features(df)

                # Log extracted features
                logging.debug(f"Extracted features for {filename}: {features}")

                X.append(features)
                y.append(label)
            else:
                logging.warning(f"Filename {filename} does not match expected patterns (_L_, _O_, _S_). Skipping.")

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
