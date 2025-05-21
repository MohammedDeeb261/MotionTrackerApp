import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense, Dropout, BatchNormalization
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from tensorflow.keras.optimizers import Adam
import json

# Settings
DATA_DIR = 'data/train'
# Always sort class folders for consistent mapping
CLASSES = sorted([d for d in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, d))])
WINDOW_SIZE = 100
N_CHANNELS = 6
BATCH_SIZE = 64
EPOCHS = 75
LEARNING_RATE = 0.0001

# Gravity removal: high-pass filter (exponential moving average)
def remove_gravity(df, alpha=0.8):
    gravity = np.zeros((df.shape[0], 3))
    filtered = np.zeros((df.shape[0], 3))
    for i in range(df.shape[0]):
        if i == 0:
            gravity[i] = df.iloc[i, 0:3]
        else:
            gravity[i] = alpha * gravity[i-1] + (1 - alpha) * df.iloc[i, 0:3]
        filtered[i] = df.iloc[i, 0:3] - gravity[i]
    # Replace AccX, AccY, AccZ with gravity-free values
    df_filtered = df.copy()
    df_filtered.iloc[:, 0:3] = filtered
    return df_filtered

def load_dataset():
    X, y = [], []
    for class_idx, class_name in enumerate(CLASSES):
        class_dir = os.path.join(DATA_DIR, class_name)
        for fname in os.listdir(class_dir):
            fpath = os.path.join(class_dir, fname)
            if fname.endswith('.csv'):
                df = pd.read_csv(fpath, header=None)  # No header, just data
                # Skip files with insufficient columns
                if df.shape[1] < 6:
                    print(f"Warning: {fpath} has only {df.shape[1]} columns, skipping.")
                    continue
                # Use columns 0-5: AccX, AccY, AccZ, GyroX, GyroY, GyroZ
                df_sensor = df.iloc[:, [0, 1, 2, 3, 4, 5]]
                # Convert all values to float, coerce errors to NaN
                df_sensor = df_sensor.apply(pd.to_numeric, errors='coerce')
                # Drop rows with any NaN values
                df_sensor = df_sensor.dropna()
                # Remove gravity from AccX, AccY, AccZ
                df_sensor = remove_gravity(df_sensor)
                # Only use windows of the correct shape
                if df_sensor.shape == (WINDOW_SIZE, N_CHANNELS):
                    X.append(df_sensor.values)
                    y.append(class_idx)
    X, y = np.array(X), np.array(y)


    # Save the class labels in sorted order
    with open('class_labels.json', 'w') as f:
        json.dump(CLASSES, f)

    return X, y

def build_cnn_model(input_shape, n_classes, X_train):
    from tensorflow.keras.layers import Normalization
    norm_layer = Normalization()
    norm_layer.adapt(X_train)
    model = Sequential([
        norm_layer,
        Conv1D(32, kernel_size=3, activation='relu', input_shape=input_shape),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),

        Conv1D(64, kernel_size=3, activation='relu'),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),

        # Removed extra Conv1D layers to match the described architecture (2 Conv1D layers)
        Flatten(),
        Dense(128, activation='relu'),
        BatchNormalization(),
        Dropout(0.5),
        Dense(n_classes, activation='softmax')
    ])
    model.compile(optimizer=Adam(learning_rate=LEARNING_RATE),
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])
    return model

def main():
    print('Loading and processing data...')
    X, y = load_dataset()
    y_cat = to_categorical(y, num_classes=len(CLASSES))
    X_train, X_val, y_train, y_val = train_test_split(X, y_cat, test_size=0.2, random_state=42)

    print('Building model...')
    model = build_cnn_model((WINDOW_SIZE, N_CHANNELS), len(CLASSES), X_train)
    es = EarlyStopping(monitor='val_loss', patience=8, restore_best_weights=True)
    checkpoint = ModelCheckpoint('best_model.h5', monitor='val_accuracy', save_best_only=True)

    print('Training...')
    model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE, validation_data=(X_val, y_val), callbacks=[es, checkpoint])
    model.save('cnn_motion_model.keras')
    print('Model saved as cnn_motion_model.keras')

if __name__ == '__main__':
    main()
