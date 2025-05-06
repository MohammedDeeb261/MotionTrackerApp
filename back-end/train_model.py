import pandas as pd
import numpy as np
import os
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib

def extract_features_from_file(file_path):
    df = pd.read_csv(file_path, header=None)

    # Extract accelerometer (cols 2–4) and gyroscope (cols 6–8)
    acc = df.iloc[:, 1:4]
    gyro = df.iloc[:, 5:8]

    features = []

    # For each sensor axis, extract basic features: mean, std, rms, max, min
    for sensor in [acc, gyro]:
        for axis in range(3):
            data = sensor.iloc[:, axis]
            features.append(data.mean())
            features.append(data.std())
            features.append(np.sqrt(np.mean(data ** 2)))  # RMS
            features.append(data.max())
            features.append(data.min())

    # Also add Signal Magnitude Area (SMA)
    sma_acc = np.mean(np.abs(acc).sum(axis=1))
    sma_gyro = np.mean(np.abs(gyro).sum(axis=1))
    features.append(sma_acc)
    features.append(sma_gyro)

    return features

def load_dataset(folder_path):
    X, y = [], []
    for filename in os.listdir(folder_path):
        if filename.endswith(".csv"):
            label = None
            if "walk" in filename.lower():
                label = 0
            elif "run" in filename.lower():
                label = 1
            elif "stair" in filename.lower():
                label = 2
            if label is not None:
                path = os.path.join(folder_path, filename)
                features = extract_features_from_file(path)
                X.append(features)
                y.append(label)
    return np.array(X), np.array(y)

def train_model(data_folder, model_path="svm_model.pkl"):
    X, y = load_dataset(data_folder)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    clf = SVC(kernel="linear")
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    print(classification_report(y_test, y_pred))
    joblib.dump(clf, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train_model("backend/dataset")
