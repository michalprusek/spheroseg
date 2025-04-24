import numpy as np
from PIL import Image

# Create a simple test image
width, height = 200, 200
image = np.zeros((height, width, 3), dtype=np.uint8)

# Create a red circle in the center
center_x, center_y = width // 2, height // 2
radius = 50
for y in range(height):
    for x in range(width):
        if (x - center_x) ** 2 + (y - center_y) ** 2 < radius ** 2:
            image[y, x] = [255, 0, 0]  # Red

# Save the image
img = Image.fromarray(image)
img.save('test_image.png')

print("Test image created: test_image.png")
