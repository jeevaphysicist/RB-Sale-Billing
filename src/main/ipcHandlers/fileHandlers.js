import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let globalDb = null;
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
  profileImagesDir = path.join(dbDirectory, 'images', 'profile');

  try {
    if (!fs.existsSync(profileImagesDir)) {
      fs.mkdirSync(profileImagesDir, { recursive: true });
      console.log('✅ Created profile images directory:', profileImagesDir);
    } else {
      console.log('✅ Profile images directory exists:', profileImagesDir);
    }
  } catch (err) {
    console.error('❌ Error creating images directory:', err);
  }

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

  console.log('✅ File IPC handlers registered');
}
