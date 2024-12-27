# mirror-service-catalog-api
This API provides access to catalog, thread, and shop-related data.

## Endpoints

### Catalog
#### `GET /catalog-update`
Updates the catalog data.

#### `GET /items/filter`
Retrieves filtered items based on query parameters.

**Query Parameters:**
- `base` (optional): Filter by base item name
  - Must contain only letters, numbers, and spaces
- `mod` (optional): Filter by affixes
  - Must contain only letters, numbers, and spaces
- `title` (optional): Filter by thread titles
  - Must contain only letters, numbers, and spaces

**Response:**
- Success: Returns filtered items
- Error (400): Returns validation errors if query parameters are invalid

### Threads

#### `GET /allthreads`
Retrieves all available threads.

#### `GET /topthreads`
Retrieves top threads.

#### `GET /threads/range`
Retrieves threads within a specified range.

#### `GET /forumthreads`
Retrieves all indexed forum threads on GGG forums.

### Shops

#### `GET /shops/range`
Retrieves shops within a specified range.

#### `GET /shop/:threadIndex`
Retrieves shop information for a specific thread.

**Parameters:**
- `threadIndex`: The index of the thread

### Other

#### `GET /`
Redirects to `/shops/range`

## Error Handling

All endpoints that accept query parameters include validation to ensure:
- Parameters are properly formatted strings
- Only letters, numbers, and spaces are allowed
- Input is sanitized to prevent XSS attacks

Error responses will include an array of validation errors with detailed messages.
