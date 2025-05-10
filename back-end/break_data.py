import os
import shutil
import random

# Paths
source_folder = 'raw_data/15.Stair-up'
train_folder = 'dataset'
test_folder = 'test_dataset'

# Make sure directories exist
os.makedirs(train_folder, exist_ok=True)
os.makedirs(test_folder, exist_ok=True)

# List all CSV files in the source folder
csv_files = [f for f in os.listdir(source_folder) if f.endswith('.csv')]

# Check if there are files to process
if not csv_files:
    print("No CSV files found in the source folder.")
    exit()

# Shuffle the list to randomize
random.shuffle(csv_files)

# Compute the split index (50%)
split_index = len(csv_files) // 2

# Split into training and testing
train_files = csv_files[:split_index]
test_files = csv_files[split_index:]

# Copy the files
print(f' Copying {len(train_files)} files to {train_folder}...')
for file in train_files:
    src = os.path.join(source_folder, file)
    dest = os.path.join(train_folder, file)
    
    if not os.path.exists(dest):
        shutil.copy(src, dest)
    else:
        print(f"⚠️ File already exists in {train_folder}: {file}")

print(f'📂 Copying {len(test_files)} files to {test_folder}...')
for file in test_files:
    src = os.path.join(source_folder, file)
    dest = os.path.join(test_folder, file)

    if not os.path.exists(dest):
        shutil.copy(src, dest)
    else:
        print(f"⚠️ File already exists in {test_folder}: {file}")

print('Dataset successfully split and copied into training and testing sets.')
