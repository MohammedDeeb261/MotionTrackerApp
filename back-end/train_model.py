import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
import tensorflow 
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense, Dropout
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.callbacks import EarlyStopping

# Import Adam optimizer with compatibility for TensorFlow 2.x and Keras standalone
try:
    from tensorflow.keras.optimizers import Adam
except ImportError:
    from keras.optimizers import Adam

# Settings
DATA_DIR = 'data/train'
CLASSES = ['walk', 'stand', 'run']
WINDOW_SIZE = 100  # 100 samples at 100Hz = 1 second
N_CHANNELS = 6
BATCH_SIZE = 32
EPOCHS = 75
LEARNING_RATE = 0.001

# Load all windows from the class directory
def load_dataset():
    X = []
    y = []
    skipped = 0
    shape_counts = {}
    for class_idx, class_name in enumerate(CLASSES):
        class_dir = os.path.join(DATA_DIR, class_name)
        print(f"[INFO] Checking class_dir: {class_dir}")
        if not os.path.exists(class_dir):
            print(f"[WARN] Directory does not exist: {class_dir}")
            continue
        for fname in os.listdir(class_dir):
            fpath = os.path.join(class_dir, fname)
            print(f"[INFO] Checking file: {fpath}")
            if fname.endswith('.csv') and os.path.isfile(fpath):
                df = pd.read_csv(fpath, header=None)
                # Select only the 6 sensor columns: accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z
                df_sensor = df.iloc[:, [1,2,3,5,6,7]]
                shape = df_sensor.shape
                shape_counts[shape] = shape_counts.get(shape, 0) + 1
                if shape == (WINDOW_SIZE, N_CHANNELS):
                    X.append(df_sensor.values)
                    y.append(class_idx)
                else:
                    print(f"[SKIP] {fpath} shape={df_sensor.shape}")
                    skipped += 1
    print(f"Loaded {len(X)} windows. Skipped {skipped} files.")
    print(f"File shape summary: {shape_counts}")
    X = np.array(X)
    y = np.array(y)
    return X, y

def build_cnn_model(input_shape, n_classes):
    model = Sequential([
        Conv1D(32, kernel_size=3, activation='relu', input_shape=input_shape),
        MaxPooling1D(pool_size=2),
        Conv1D(64, kernel_size=3, activation='relu'),
        MaxPooling1D(pool_size=2),
        Conv1D(128, kernel_size=3, activation='relu'),
        Flatten(),
        Dense(128, activation='relu'),
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
    print(f'Dataset shape: {X.shape}, Labels: {y.shape}')
    y_cat = to_categorical(y, num_classes=len(CLASSES))
    X_train, X_val, y_train, y_val = train_test_split(X, y_cat, test_size=0.2, random_state=42)

    print('Building model...')
    model = build_cnn_model((WINDOW_SIZE, N_CHANNELS), len(CLASSES))
    es = EarlyStopping(monitor='val_loss', patience=8, restore_best_weights=True)
    print('Training...')
    model.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE, validation_data=(X_val, y_val), callbacks=[es])
    model.save('cnn_motion_model.h5')
    print('Model saved as cnn_motion_model.h5')

if __name__ == '__main__':
    main()
