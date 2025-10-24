import express, { Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { encryptUserConfig, decryptUserConfig } from '../utils/userConfigEncryption';
import logger from '../utils/logger';

const router = express.Router();

// 保存用户配置（加密存储到 cookie）
router.post('/save', authenticateToken, (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: '配置数据格式错误' });
    }
    
    // 加密配置
    const encryptedConfig = encryptUserConfig(config);
    
    // 设置加密的 cookie（httpOnly, secure）
    res.cookie('user_config', encryptedConfig, {
      httpOnly: true,
      secure: false, // 生产环境应设为 true
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
      path: '/'
    });
    
    const authReq = req as AuthRequest;
    logger.info('User config saved', { userId: authReq.userId });
    
    res.json({ 
      success: true, 
      message: '配置已保存',
      encryptedConfig // 也返回加密字符串供前端存储备份
    });
  } catch (error: any) {
    logger.error('Failed to save user config:', error);
    res.status(500).json({ error: '保存配置失败' });
  }
});

// 获取用户配置（从 cookie 解密）
router.get('/get', authenticateToken, (req: Request, res: Response) => {
  try {
    const encryptedConfig = req.cookies.user_config;
    
    if (!encryptedConfig) {
      return res.json({ 
        success: true, 
        config: null,
        message: '未找到保存的配置' 
      });
    }
    
    // 解密配置
    const config = decryptUserConfig(encryptedConfig);
    
    res.json({ 
      success: true, 
      config 
    });
  } catch (error: any) {
    logger.error('Failed to get user config:', error);
    res.status(500).json({ error: '获取配置失败' });
  }
});

// 清除用户配置
router.post('/clear', authenticateToken, (req: Request, res: Response) => {
  try {
    res.clearCookie('user_config', { path: '/' });
    
    const authReq = req as AuthRequest;
    logger.info('User config cleared', { userId: authReq.userId });
    
    res.json({ 
      success: true, 
      message: '配置已清除' 
    });
  } catch (error: any) {
    logger.error('Failed to clear user config:', error);
    res.status(500).json({ error: '清除配置失败' });
  }
});

export default router;
