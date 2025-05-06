import os
import pandas as pd
import numpy as np
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
import joblib

LABEL_MAP = {'L': 'walk', 'O': 'run', 'S': 'stair_up'}

def extract_features(df):
    features = []
    for i in range(2, 5):  # Acc X, Y, Z columns
        axis_data = df.iloc[:, i]
        features.extend([
            axis_data.mean(),
            axis_data.std(),
            np.sqrt(np.mean(axis_data ** 2)),  # RMS
            axis_data.max(),
            axis_data.min()
        ])
    for i in range(5, 8):  # Gyro X, Y, Z columns
        axis_data = df.iloc[:, i]
        features.extend([
            axis_data.mean(),
            axis_data.std(),
            np.sqrt(np.mean(axis_data ** 2)),
            axis_data.max(),
            axis_data.min()
        ])
    sma = df.iloc[:, 2:5].abs().sum().sum() / len(df)
    features.append(sma)
    return features

def train_model(dataset_dir):
    X, y = [], []

    for filename in os.listdir(dataset_dir):
        label_code = filename.split('_')[1]
        label = LABEL_MAP.get(label_code)
        if label:
            path = os.path.join(dataset_dir, filename)
            df = pd.read_csv(path, header=None)
            features = extract_features(df)
            X.append(features)
            y.append(label)

    model = SVC(kernel='linear', probability=True)
    model.fit(X, y)
    joblib.dump(model, 'svm_model.pkl')
    print("Model trained and saved as svm_model.pkl")
