#!/usr/bin/env python3
with open("/app/worker/celery.py", "r") as f:
    content = f.read()

# Replace the function definition to include the object_name parameter
new_def = "@celery.task(name=\"segment_image\", bind=True, max_retries=3)\ndef segment_image(self, image_id, object_name=None):"
old_def = "@celery.task(name=\"segment_image\", bind=True, max_retries=3)\ndef segment_image(self, image_id):"

updated_content = content.replace(old_def, new_def)

# Add code to handle the object_name parameter
old_line = "        image_object_name = result.object_name"
new_line = "        # Use object_name from parameter if provided, otherwise from database\n        image_object_name = object_name if object_name else result.object_name"

updated_content = updated_content.replace(old_line, new_line)

with open("/app/worker/celery.py", "w") as f:
    f.write(updated_content)

print("Fixed celery.py file") 