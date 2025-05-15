import os
import shutil
import random

INPUT_ROOT = 'data/all_data_overlap'
TRAIN_ROOT = 'data/train'
TEST_ROOT = 'data/test'
CLASSES = ['walk', 'stand', 'run']
TRAIN_RATIO = 0.75

os.makedirs(TRAIN_ROOT, exist_ok=True)
os.makedirs(TEST_ROOT, exist_ok=True)

for class_name in CLASSES:
    input_class_dir = os.path.join(INPUT_ROOT, class_name)
    train_class_dir = os.path.join(TRAIN_ROOT, class_name)
    test_class_dir = os.path.join(TEST_ROOT, class_name)
    os.makedirs(train_class_dir, exist_ok=True)
    os.makedirs(test_class_dir, exist_ok=True)
    files = [f for f in os.listdir(input_class_dir) if f.endswith('.csv')]
    random.shuffle(files)
    split_idx = int(len(files) * TRAIN_RATIO)
    train_files = files[:split_idx]
    test_files = files[split_idx:]
    for f in train_files:
        shutil.copy(os.path.join(input_class_dir, f), os.path.join(train_class_dir, f))
    for f in test_files:
        shutil.copy(os.path.join(input_class_dir, f), os.path.join(test_class_dir, f))
print(f"Data split: {TRAIN_RATIO*100:.0f}% training, {100-TRAIN_RATIO*100:.0f}% testing. Results in {TRAIN_ROOT} and {TEST_ROOT}.")
