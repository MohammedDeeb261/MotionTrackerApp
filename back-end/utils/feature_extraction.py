import numpy as np

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
    sma = np.sum(np.abs(df[['acc_x', 'acc_y', 'acc_z']]).sum(axis=0)) / len(df)
    features.append(sma)
    return features