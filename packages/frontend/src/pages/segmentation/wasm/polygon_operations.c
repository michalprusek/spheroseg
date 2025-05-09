#include <stdlib.h>
#include <stdbool.h>
#include <math.h>
#include <emscripten.h>

// Define a point structure
typedef struct {
    double x;
    double y;
} Point;

// Define a polygon structure
typedef struct {
    Point* points;
    int length;
} Polygon;

// Check if a point is inside a polygon using ray casting algorithm
EMSCRIPTEN_KEEPALIVE
bool is_point_in_polygon(double x, double y, Point* points, int length) {
    bool inside = false;
    
    for (int i = 0, j = length - 1; i < length; j = i++) {
        double xi = points[i].x;
        double yi = points[i].y;
        double xj = points[j].x;
        double yj = points[j].y;
        
        bool intersect = ((yi > y) != (yj > y)) && 
                         (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
        if (intersect) {
            inside = !inside;
        }
    }
    
    return inside;
}

// Calculate the distance from a point to a line segment
EMSCRIPTEN_KEEPALIVE
double distance_to_segment(double px, double py, double vx, double vy, double wx, double wy) {
    // Calculate squared length of segment
    double l2 = pow(vx - wx, 2) + pow(vy - wy, 2);
    
    // If segment is a point, return distance to that point
    if (l2 == 0) {
        return sqrt(pow(px - vx, 2) + pow(py - vy, 2));
    }
    
    // Calculate projection of point onto line containing segment
    double t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
    
    // If projection is outside segment, return distance to nearest endpoint
    if (t < 0) {
        return sqrt(pow(px - vx, 2) + pow(py - vy, 2));
    }
    if (t > 1) {
        return sqrt(pow(px - wx, 2) + pow(py - wy, 2));
    }
    
    // Calculate projection point on segment
    double projx = vx + t * (wx - vx);
    double projy = vy + t * (wy - vy);
    
    // Return distance to projection point
    return sqrt(pow(px - projx, 2) + pow(py - projy, 2));
}

// Calculate the intersection point of two line segments
// Returns 1 if lines intersect, 0 if they don't
// Stores intersection point in ix, iy
EMSCRIPTEN_KEEPALIVE
int calculate_intersection(
    double p1x, double p1y, double p2x, double p2y,
    double p3x, double p3y, double p4x, double p4y,
    double* ix, double* iy
) {
    // Line 1 represented as a1x + b1y = c1
    double a1 = p2y - p1y;
    double b1 = p1x - p2x;
    double c1 = a1 * p1x + b1 * p1y;
    
    // Line 2 represented as a2x + b2y = c2
    double a2 = p4y - p3y;
    double b2 = p3x - p4x;
    double c2 = a2 * p3x + b2 * p3y;
    
    double determinant = a1 * b2 - a2 * b1;
    
    if (determinant == 0) {
        // Lines are parallel
        return 0;
    }
    
    *ix = (b2 * c1 - b1 * c2) / determinant;
    *iy = (a1 * c2 - a2 * c1) / determinant;
    
    // Check if the intersection point is on both line segments
    bool onSegment1 = 
        fmin(p1x, p2x) <= *ix && *ix <= fmax(p1x, p2x) &&
        fmin(p1y, p2y) <= *iy && *iy <= fmax(p1y, p2y);
    
    bool onSegment2 = 
        fmin(p3x, p4x) <= *ix && *ix <= fmax(p3x, p4x) &&
        fmin(p3y, p4y) <= *iy && *iy <= fmax(p3y, p4y);
    
    if (onSegment1 && onSegment2) {
        return 1;
    }
    
    return 0;
}

// Calculate the area of a polygon using the Shoelace formula
EMSCRIPTEN_KEEPALIVE
double calculate_polygon_area(Point* points, int length) {
    double area = 0;
    
    for (int i = 0; i < length; i++) {
        int j = (i + 1) % length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    
    return fabs(area / 2);
}

// Calculate the perimeter of a polygon
EMSCRIPTEN_KEEPALIVE
double calculate_polygon_perimeter(Point* points, int length) {
    double perimeter = 0;
    
    for (int i = 0; i < length; i++) {
        int j = (i + 1) % length;
        perimeter += sqrt(
            pow(points[j].x - points[i].x, 2) + 
            pow(points[j].y - points[i].y, 2)
        );
    }
    
    return perimeter;
}

// Calculate the bounding box of a polygon
EMSCRIPTEN_KEEPALIVE
void calculate_bounding_box(
    Point* points, int length,
    double* minX, double* minY, double* maxX, double* maxY
) {
    if (length == 0) {
        *minX = 0;
        *minY = 0;
        *maxX = 0;
        *maxY = 0;
        return;
    }
    
    *minX = points[0].x;
    *minY = points[0].y;
    *maxX = points[0].x;
    *maxY = points[0].y;
    
    for (int i = 1; i < length; i++) {
        if (points[i].x < *minX) *minX = points[i].x;
        if (points[i].y < *minY) *minY = points[i].y;
        if (points[i].x > *maxX) *maxX = points[i].x;
        if (points[i].y > *maxY) *maxY = points[i].y;
    }
}

// Check if two polygons intersect
EMSCRIPTEN_KEEPALIVE
bool do_polygons_intersect(Point* poly1, int len1, Point* poly2, int len2) {
    // Check if any point of poly1 is inside poly2
    for (int i = 0; i < len1; i++) {
        if (is_point_in_polygon(poly1[i].x, poly1[i].y, poly2, len2)) {
            return true;
        }
    }
    
    // Check if any point of poly2 is inside poly1
    for (int i = 0; i < len2; i++) {
        if (is_point_in_polygon(poly2[i].x, poly2[i].y, poly1, len1)) {
            return true;
        }
    }
    
    // Check if any edges intersect
    for (int i = 0; i < len1; i++) {
        int j = (i + 1) % len1;
        
        for (int k = 0; k < len2; k++) {
            int l = (k + 1) % len2;
            
            double ix, iy;
            if (calculate_intersection(
                poly1[i].x, poly1[i].y, poly1[j].x, poly1[j].y,
                poly2[k].x, poly2[k].y, poly2[l].x, poly2[l].y,
                &ix, &iy
            )) {
                return true;
            }
        }
    }
    
    return false;
}

// Memory management functions
EMSCRIPTEN_KEEPALIVE
Point* create_point_array(int length) {
    return (Point*)malloc(length * sizeof(Point));
}

EMSCRIPTEN_KEEPALIVE
void set_point(Point* points, int index, double x, double y) {
    points[index].x = x;
    points[index].y = y;
}

EMSCRIPTEN_KEEPALIVE
void free_point_array(Point* points) {
    free(points);
}

// Main function (required for compilation)
int main() {
    return 0;
}
