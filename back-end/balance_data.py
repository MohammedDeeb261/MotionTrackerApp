import os
import random
import shutil

# Paths to train and test directories
TRAIN_DIR = 'data/train'
TEST_DIR = 'data/test'

# Set random seed for reproducibility
random.seed(42)

def balance_folder(folder_path):
    # Get all class subfolders
    class_folders = [d for d in os.listdir(folder_path) if os.path.isdir(os.path.join(folder_path, d))]
    # Get list of file counts for each class
    file_counts = {}
    for cls in class_folders:
        cls_path = os.path.join(folder_path, cls)
        files = [f for f in os.listdir(cls_path) if f.endswith('.csv')]
        file_counts[cls] = len(files)
    # Find the minimum count
    min_count = min(file_counts.values())
    print(f'Balancing {folder_path}: limiting each class to {min_count} samples')
    # For each class, randomly remove extra files
    for cls in class_folders:
        cls_path = os.path.join(folder_path, cls)
        files = [f for f in os.listdir(cls_path) if f.endswith('.csv')]
        if len(files) > min_count:
            to_remove = random.sample(files, len(files) - min_count)
            for f in to_remove:
                os.remove(os.path.join(cls_path, f))
                print(f'Removed {os.path.join(cls_path, f)}')

if __name__ == '__main__':
    balance_folder(TRAIN_DIR)
    balance_folder(TEST_DIR)
    print('Balancing complete.')
