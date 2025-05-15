import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model

DATA_DIR = 'data/test'
CLASSES = ['walk', 'stand', 'run']
WINDOW_SIZE = 100
N_CHANNELS = 6
MODEL_PATH = 'cnn_motion_model.h5'

# Load the trained model
model = load_model(MODEL_PATH)

results = {cls: {'correct': 0, 'total': 0} for cls in CLASSES}

for class_idx, class_name in enumerate(CLASSES):
    class_dir = os.path.join(DATA_DIR, class_name)
    for fname in os.listdir(class_dir):
        fpath = os.path.join(class_dir, fname)
        if fname.endswith('.csv') and os.path.isfile(fpath):
            df = pd.read_csv(fpath, header=None)
            if df.shape[1] == 8:
                # Select only the 6 sensor columns
                df = df.iloc[:, [1,2,3,5,6,7]]
            if df.shape == (WINDOW_SIZE, N_CHANNELS):
                x = df.values.reshape(1, WINDOW_SIZE, N_CHANNELS)
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
plt.bar(CLASSES, accuracies, color=['#4caf50', '#2196f3', '#ff9800'])
plt.ylim(0, 100)
plt.ylabel('Accuracy (%)')
plt.title('Model Accuracy per Activity')
plt.savefig('test_accuracy_per_activity.png')
plt.show()
print('Saved accuracy graph as test_accuracy_per_activity.png')
