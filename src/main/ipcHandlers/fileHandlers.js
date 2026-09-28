import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let globalDb = null;
let imagesDir = null;
let profileImagesDir = null;

export function initializeFileHandlers(db, dbPath) {
  if (!db) {
    console.error('❌ Database instance is required for file handlers');
    return false;
  }
  
  globalDb = db;
  console.log('✅ File handlers initialized with database:', !!db);

  // Create images directory in the same location as the database
  const dbDirectory = path.dirname(dbPath);
  imagesDir = path.join(dbDirectory, 'images', 'product_images');
  profileImagesDir = path.join(dbDirectory, 'images', 'profile');
  
  try {
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log('✅ Created product images directory:', imagesDir);
    } else {
      console.log('✅ Product images directory exists:', imagesDir);
    }

    if (!fs.existsSync(profileImagesDir)) {
      fs.mkdirSync(profileImagesDir, { recursive: true });
      console.log('✅ Created profile images directory:', profileImagesDir);
    } else {
      console.log('✅ Profile images directory exists:', profileImagesDir);
    }
  } catch (err) {
    console.error('❌ Error creating images directory:', err);
  }

  // Upload Product Image
  ipcMain.handle('file:upload-product-image', async (event, { fileData, fileName, mimeType, productId }) => {
    try {
      console.log('📥 Uploading product image:', fileName, 'for product:', productId);
      console.log('📁 Images directory:', imagesDir);

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(fileName);
      const uniqueFileName = `product_${productId || 'temp'}_${timestamp}${ext}`;
      const filePath = path.join(imagesDir, uniqueFileName);

      console.log('💾 Saving to:', filePath);

      // Convert base64 to buffer and save file
      const buffer = Buffer.from(fileData, 'base64');
      fs.writeFileSync(filePath, buffer);

      console.log('✅ Image saved successfully! Size:', buffer.length, 'bytes');
      console.log('✅ File exists:', fs.existsSync(filePath));

      // If productId is provided, save to database
      if (productId) {
        await new Promise((resolve, reject) => {
          globalDb.run(
            `INSERT INTO product_images (product_id, image_path, image_name, file_size, mime_type, is_primary)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [productId, filePath, uniqueFileName, buffer.length, mimeType],
            function(err) {
              if (err) {
                console.error('❌ Error saving image to database:', err);
                reject(err);
              } else {
                console.log('✅ Image record created with ID:', this.lastID);
                resolve({ id: this.lastID });
              }
            }
          );
        });
      }

      return {
        success: true,
        filePath: filePath,
        fileName: uniqueFileName,
        message: 'Image uploaded successfully'
      };
    } catch (error) {
      console.error('❌ Upload image error:', error);
      return {
        success: false,
        message: error.message || 'Failed to upload image'
      };
    }
  });

  // Upload Profile Image
  ipcMain.handle('file:upload-profile-image', async (event, { fileData, fileName, userId }) => {
    try {
      console.log('📥 Uploading profile image:', fileName, 'for user:', userId);
      
      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(fileName);
      const uniqueFileName = `profile_${userId || 'temp'}_${timestamp}${ext}`;
      const filePath = path.join(profileImagesDir, uniqueFileName);

      console.log('💾 Saving to:', filePath);

      // Convert base64 to buffer and save file
      const buffer = Buffer.from(fileData, 'base64');
      fs.writeFileSync(filePath, buffer);

      console.log('✅ Profile image saved successfully!');

      // Return the file path to be stored in the users table
      // We return a file:// URL for easier display in frontend if needed, or just the absolute path
      // The frontend currently seems to handle absolute paths or URLs. 
      // Let's return the absolute path, and the frontend can prepend file:// if needed or electron handles it.
      // Actually, for local files in Electron, usually `file://` protocol is safer or required for some contexts.
      // But let's stick to returning the absolute path as requested by "add in data store path".
      
      return {
        success: true,
        filePath: filePath,
        fileName: uniqueFileName,
        message: 'Profile image uploaded successfully'
      };
    } catch (error) {
      console.error('❌ Upload profile image error:', error);
      return {
        success: false,
        message: error.message || 'Failed to upload profile image'
      };
    }
  });

  // Get Profile Image
  ipcMain.handle('file:get-profile-image', async (event, userId) => {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      const user = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT photo FROM users WHERE id = ?`,
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user || !user.photo) {
        return { success: false, message: 'No profile image found' };
      }

      // Handle both file:// paths and absolute paths
      let imagePath = user.photo;
      if (imagePath.startsWith('file://')) {
        imagePath = fileURLToPath(imagePath);
      }

      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        let mimeType = 'image/jpeg'; // default
        if (ext === '.png') mimeType = 'image/png';
        if (ext === '.webp') mimeType = 'image/webp';
        
        const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        
        return {
          success: true,
          imageData: base64Image
        };
      }

      return { success: false, message: 'Image file not found' };

    } catch (error) {
      console.error('❌ Get profile image error:', error);
      return {
        success: false,
        message: 'Failed to fetch profile image'
      };
    }
  });

  // Get Product Images
  ipcMain.handle('file:get-product-images', async (event, productId) => {
    try {
      if (!productId) {
        return { success: false, message: 'Product ID is required' };
      }

      const images = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC`,
          [productId],
          (err, rows) => {
            if (err) {
              console.error('❌ Error fetching product images:', err);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      // Convert file paths to base64 for display
      const imagesWithData = images.map(img => {
        try {
          if (fs.existsSync(img.image_path)) {
            const imageBuffer = fs.readFileSync(img.image_path);
            const base64Image = `data:${img.mime_type};base64,${imageBuffer.toString('base64')}`;
            return {
              ...img,
              imageData: base64Image
            };
          }
          return img;
        } catch (err) {
          console.error('Error reading image file:', err);
          return img;
        }
      });

      return {
        success: true,
        data: imagesWithData
      };
    } catch (error) {
      console.error('❌ Get product images error:', error);
      return {
        success: false,
        message: 'Failed to fetch product images'
      };
    }
  });

  // Delete Product Image
  ipcMain.handle('file:delete-product-image', async (event, imageId) => {
    try {
      if (!imageId) {
        return { success: false, message: 'Image ID is required' };
      }

      // Get image path before deleting
      const image = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT image_path FROM product_images WHERE id = ?`,
          [imageId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!image) {
        return { success: false, message: 'Image not found' };
      }

      // Delete file from filesystem
      if (fs.existsSync(image.image_path)) {
        fs.unlinkSync(image.image_path);
        console.log('✅ Image file deleted:', image.image_path);
      }

      // Delete from database
      await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM product_images WHERE id = ?`,
          [imageId],
          function(err) {
            if (err) {
              console.error('❌ Error deleting image from database:', err);
              reject(err);
            } else {
              console.log('✅ Image record deleted');
              resolve();
            }
          }
        );
      });

      return {
        success: true,
        message: 'Image deleted successfully'
      };
    } catch (error) {
      console.error('❌ Delete image error:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete image'
      };
    }
  });

  // Get image file path for local access
  ipcMain.handle('file:get-image-path', async (event, imageId) => {
    try {
      const image = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT image_path, mime_type FROM product_images WHERE id = ?`,
          [imageId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!image || !fs.existsSync(image.image_path)) {
        return { success: false, message: 'Image not found' };
      }

      return {
        success: true,
        path: image.image_path,
        mimeType: image.mime_type
      };
    } catch (error) {
      console.error('❌ Get image path error:', error);
      return {
        success: false,
        message: 'Failed to get image path'
      };
    }
  });

  console.log('✅ File IPC handlers registered');
}
