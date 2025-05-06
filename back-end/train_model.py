import os
import pandas as pd
import numpy as np
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
import joblib

MODEL_PATH = "backend/svm_model.pkl"

def extract_features(df):
    features = []
    for col in ['acc_x', 'acc_y', 'acc_z', 'gyro_x', 'gyro_y', 'gyro_z']:
        series = df[col]
        features.extend([
            series.mean(),
            series.std(),
            np.sqrt(np.mean(series**2)),  # RMS
            series.max(),
            series.min()
        ])
    sma = np.sum(np.abs(df[['acc_x', 'acc_y', 'acc_z']])).sum() / len(df)
    features.append(sma)
    return features

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
                features = extract_features(df)
                X.append(features)
                y.append(label)
    return np.array(X), np.array(y)

def train_model(data_dir):
    X, y = load_csv_files(data_dir)
    clf = make_pipeline(StandardScaler(), SVC(kernel='linear'))
    clf.fit(X, y)
    joblib.dump(clf, MODEL_PATH)

def load_model_and_predict(feature_dict):
    clf = joblib.load(MODEL_PATH)
    x_input = np.array([list(feature_dict.values())]).reshape(1, -1)
    prediction = clf.predict(x_input)[0]
    label_map = {0: "walk", 1: "run", 2: "stair up"}
    return label_map[prediction]
