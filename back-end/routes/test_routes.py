from flask import Blueprint, jsonify
from services.evaluation_service import evaluate_model
import matplotlib.pyplot as plt

# Define the blueprint for test routes
test_routes = Blueprint('test_routes', __name__)

@test_routes.route("/", methods=["GET"])
def test_model():
    try:
        result = evaluate_model("test_dataset")

        # Generate a bar chart for the results
        activities = list(result.keys())
        passed = [result[activity]["passed"] for activity in activities]
        total = [result[activity]["total"] for activity in activities]

        x = range(len(activities))
        plt.bar(x, total, color='lightgray', label='Total')
        plt.bar(x, passed, color='green', label='Passed')
        plt.xticks(x, activities)
        plt.xlabel('Activities')
        plt.ylabel('Number of Files')
        plt.title('Testing Results')
        plt.legend()

        # Add text annotations for passed counts only
        for i, activity in enumerate(activities):
            plt.text(i, total[i], f"Passed: {passed[i]}/{total[i]}", ha='center', va='bottom', fontsize=9, color='black')

        # Save the graph as an image
        graph_path = "evaluation_results.png"
        plt.savefig(graph_path)
        plt.close()

        # Prepare pass and fail summary
        summary = {
            activity: {
                "passed": result[activity]["passed"],
                "failed": result[activity]["total"] - result[activity]["passed"]
            } for activity in activities
        }

        return jsonify({"message": "Evaluation completed. Graph saved.", "graph_path": graph_path, "summary": summary})
    except Exception as e:
        return jsonify({"error": str(e)}), 500