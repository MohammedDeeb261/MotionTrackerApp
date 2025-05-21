import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import json

DATA_DIR = 'data/test'
WINDOW_SIZE = 100
N_CHANNELS = 6
MODEL_PATH = 'cnn_motion_model.keras'

# Always load class labels from class_labels.json for consistent mapping
with open('class_labels.json', 'r') as f:
    CLASSES = json.load(f)

# Load the trained model
model = load_model(MODEL_PATH)

results = {cls: {'correct': 0, 'total': 0} for cls in CLASSES}

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

for class_idx, class_name in enumerate(CLASSES):
    class_dir = os.path.join(DATA_DIR, class_name)
    for fname in os.listdir(class_dir):
        fpath = os.path.join(class_dir, fname)
        if fname.endswith('.csv') and os.path.isfile(fpath):
            df = pd.read_csv(fpath, header=None)
            # Always use columns 0-5 for AccX,AccY,AccZ,GyroX,GyroY,GyroZ
            if df.shape[1] >= 6:
                df = df.iloc[:, [0,1,2,3,4,5]]
            # Convert all values to float, coerce errors to NaN, drop NaN rows
            df = df.apply(pd.to_numeric, errors='coerce').dropna()
            # Remove gravity from AccX, AccY, AccZ
            df = remove_gravity(df)
            if df.shape == (WINDOW_SIZE, N_CHANNELS):
                x = df.values.astype(np.float32).reshape(1, WINDOW_SIZE, N_CHANNELS)
                pred = model.predict(x)
                pred_class = np.argmax(pred)
                results[class_name]['total'] += 1
                if pred_class == class_idx:
                    results[class_name]['correct'] += 1

# Calculate accuracy for each class
accuracies = []
for cls in CLASSES:
    total = results[cls]['total']
    correct = results[cls]['correct']
    acc = (correct / total) * 100 if total > 0 else 0
    accuracies.append(acc)
    print(f"{cls}: {acc:.2f}% accuracy ({correct}/{total})")

# Plot accuracy bar graph
plt.figure(figsize=(8, 5))
plt.bar(CLASSES, accuracies)
plt.ylim(0, 100)
plt.ylabel('Accuracy (%)')
plt.title('Model Accuracy per Activity')
plt.savefig('test_accuracy_per_activity.png')
plt.show()
print('Saved accuracy graph as test_accuracy_per_activity.png')

# Additional graphs
# 1. Confusion Matrix
all_true = []
all_pred = []
for class_idx, class_name in enumerate(CLASSES):
    class_dir = os.path.join(DATA_DIR, class_name)
    for fname in os.listdir(class_dir):
        fpath = os.path.join(class_dir, fname)
        if fname.endswith('.csv') and os.path.isfile(fpath):
            df = pd.read_csv(fpath, header=None)
            if df.shape[1] >= 6:
                df = df.iloc[:, [0,1,2,3,4,5]]
            df = df.apply(pd.to_numeric, errors='coerce').dropna()
            # Remove gravity from AccX, AccY, AccZ (was missing in confusion matrix section)
            df = remove_gravity(df)
            if df.shape == (WINDOW_SIZE, N_CHANNELS):
                x = df.values.astype(np.float32).reshape(1, WINDOW_SIZE, N_CHANNELS)
                pred = model.predict(x)
                pred_class = np.argmax(pred)
                all_true.append(class_idx)
                all_pred.append(pred_class)
cm = confusion_matrix(all_true, all_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=CLASSES)
plt.figure(figsize=(8, 6))
disp.plot(cmap='Blues', xticks_rotation=45)
plt.title('Confusion Matrix')
plt.savefig('test_confusion_matrix.png')
plt.show()
print('Saved confusion matrix as test_confusion_matrix.png')

# 2. Per-class sample counts
sample_counts = [results[cls]['total'] for cls in CLASSES]
plt.figure(figsize=(8, 5))
plt.bar(CLASSES, sample_counts, color='orange')
plt.ylabel('Number of Samples')
plt.title('Number of Test Samples per Activity')
plt.savefig('test_samples_per_activity.png')
plt.show()
print('Saved sample count graph as test_samples_per_activity.png')

# 3. Per-class correct/incorrect stacked bar
correct_counts = [results[cls]['correct'] for cls in CLASSES]
incorrect_counts = [results[cls]['total'] - results[cls]['correct'] for cls in CLASSES]
plt.figure(figsize=(8, 5))
plt.bar(CLASSES, correct_counts, label='Correct', color='green')
plt.bar(CLASSES, incorrect_counts, bottom=correct_counts, label='Incorrect', color='red')
plt.ylabel('Samples')
plt.title('Correct vs Incorrect Predictions per Activity')
plt.legend()
plt.savefig('test_correct_vs_incorrect.png')
plt.show()
print('Saved correct/incorrect stacked bar as test_correct_vs_incorrect.png')
