import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
  Label,
  Select,
  tokens,
} from '@fluentui/react-components';
import { userConfigAPI } from '../services/api';

const AIConfigCheckPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [showManualConfig, setShowManualConfig] = useState(false);
  
  // AI配置状态
  const [aiApiUrl, setAiApiUrl] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-3.5-turbo');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // 重试获取模型列表（最多3次）
  const fetchModelsWithRetry = async (apiUrl: string, apiKey: string, attempt: number = 1): Promise<string[]> => {
    const maxRetries = 3;
    
    try {
      const modelsUrl = apiUrl.replace('/chat/completions', '/models').replace('/v1/chat/completions', '/v1/models');
      
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        const excludePatterns = ['embedding', 'whisper', 'tts', 'dall-e', 'davinci', 'babbage', 'ada', 'curie'];
        
        const models = data.data
          .map((m: any) => m.id)
          .filter((id: string) => {
            const lowerId = id.toLowerCase();
            return !excludePatterns.some(pattern => lowerId.includes(pattern));
          })
          .sort();
        
        return models;
      } else {
        throw new Error('API 返回的数据格式不正确');
      }
    } catch (err: any) {
      console.error(`获取模型列表失败 (尝试 ${attempt}/${maxRetries}):`, err);
      
      // 如果还有重试机会，等待后重试
      if (attempt < maxRetries) {
        setRetryCount(attempt);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
        return fetchModelsWithRetry(apiUrl, apiKey, attempt + 1);
      }
      
      throw new Error(err.message || '网络连接失败');
    }
  };

  // 检查并自动获取AI配置
  useEffect(() => {
    const checkAndFetchConfig = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        
        // 1. 尝试从服务器获取配置
        let config = null;
        try {
          const resp = await userConfigAPI.get();
          config = resp.data?.config;
        } catch (err) {
          console.warn('从服务器获取配置失败，尝试使用本地配置', err);
        }
        
        // 2. 如果服务器没有配置，尝试从 localStorage 获取
        if (!config?.apiUrl || !config?.apiKey) {
          const localApiUrl = localStorage.getItem('aiApiUrl');
          const localApiKey = localStorage.getItem('aiApiKey');
          const localModel = localStorage.getItem('aiModel');
          
          if (localApiUrl && localApiKey) {
            config = {
              apiUrl: localApiUrl,
              apiKey: localApiKey,
              model: localModel || 'gpt-3.5-turbo',
            };
          }
        }
        
        // 3. 如果没有配置，显示手动配置界面
        if (!config?.apiUrl || !config?.apiKey) {
          setErrorMessage('未检测到 AI 配置，请手动配置');
          setShowManualConfig(true);
          setLoading(false);
          return;
        }
        
        // 4. 有配置，尝试获取模型列表（带重试）
        setAiApiUrl(config.apiUrl);
        setAiApiKey(config.apiKey);
        setAiModel(config.model || 'gpt-3.5-turbo');
        
        try {
          const models = await fetchModelsWithRetry(config.apiUrl, config.apiKey);
          
          if (models.length > 0) {
            // 成功获取模型列表，保存到 localStorage
            setAvailableModels(models);
            localStorage.setItem('aiAvailableModels', JSON.stringify(models));
            
            // 如果当前模型不在列表中，设置为第一个模型
            if (!models.includes(config.model)) {
              const newModel = models[0];
              setAiModel(newModel);
              localStorage.setItem('aiModel', newModel);
              
              // 尝试保存到服务器
              try {
                await userConfigAPI.save({ 
                  apiUrl: config.apiUrl, 
                  apiKey: config.apiKey, 
                  model: newModel 
                });
              } catch (err) {
                console.warn('保存模型到服务器失败', err);
              }
            }
            
            // 配置成功，跳转到主页面
            setTimeout(() => {
              navigate('/overtime-records');
            }, 500);
          } else {
            throw new Error('未获取到可用模型');
          }
        } catch (err: any) {
          setErrorMessage(`获取模型列表失败（已重试3次）: ${err.message}`);
          setShowManualConfig(true);
        }
      } catch (err: any) {
        console.error('配置检查失败:', err);
        setErrorMessage(err.message || '配置检查失败');
        setShowManualConfig(true);
      } finally {
        setLoading(false);
      }
    };

    checkAndFetchConfig();
  }, [navigate]);

  // 创建稳定的事件处理器避免重新渲染
  const handleApiUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAiApiUrl(e.target.value);
  }, []);

  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAiApiKey(e.target.value);
  }, []);

  const handleModelChange = useCallback((_: any, data: any) => {
    setAiModel(data.value);
  }, []);

  // 手动获取模型列表
  const handleFetchModels = async () => {
    if (!aiApiUrl || !aiApiKey) {
      setErrorMessage('请先填写 API 地址和 API Key');
      return;
    }

    setFetchingModels(true);
    setErrorMessage('');
    
    try {
      const models = await fetchModelsWithRetry(aiApiUrl, aiApiKey);
      
      if (models.length > 0) {
        setAvailableModels(models);
        localStorage.setItem('aiAvailableModels', JSON.stringify(models));
        
        if (!models.includes(aiModel)) {
          setAiModel(models[0]);
        }
      } else {
        throw new Error('未获取到可用模型');
      }
    } catch (err: any) {
      setErrorMessage(`获取模型列表失败: ${err.message}`);
    } finally {
      setFetchingModels(false);
    }
  };

  // 保存配置并继续
  const handleSaveAndContinue = async () => {
    if (!aiApiUrl || !aiApiKey || !aiModel) {
      setErrorMessage('请填写完整的配置信息');
      return;
    }

    // 保存到 localStorage
    localStorage.setItem('aiApiUrl', aiApiUrl);
    localStorage.setItem('aiApiKey', aiApiKey);
    localStorage.setItem('aiModel', aiModel);
    
    // 尝试保存到服务器
    try {
      await userConfigAPI.save({ 
        apiUrl: aiApiUrl, 
        apiKey: aiApiKey, 
        model: aiModel 
      });
    } catch (err) {
      console.warn('保存到服务器失败，仅保存到本地', err);
    }
    
    // 跳转到主页面
    navigate('/overtime-records');
  };

  // 跳过配置
  const handleSkip = () => {
    navigate('/overtime-records');
  };

  if (loading && !showManualConfig) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: '20px',
        backgroundColor: tokens.colorNeutralBackground1,
      }}>
        <Spinner size="extra-large" />
        <div style={{ fontSize: '18px', fontWeight: 500 }}>
          正在检查 AI 配置...
        </div>
        {retryCount > 0 && (
          <div style={{ fontSize: '14px', color: tokens.colorNeutralForeground3 }}>
            正在重试 ({retryCount}/3)
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: tokens.colorNeutralBackground1,
    }}>
      <Dialog open={true} modalType="modal">
        <DialogSurface style={{ maxWidth: '600px' }}>
          <DialogBody>
            <DialogTitle>AI 配置</DialogTitle>
            <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMessage && (
                <MessageBar intent="warning">
                  <MessageBarBody>{errorMessage}</MessageBarBody>
                </MessageBar>
              )}

              <div key="api-url-section">
                <Label required style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  API 地址
                </Label>
                <Input
                  key="api-url-input-stable"
                  value={aiApiUrl}
                  onChange={handleApiUrlChange}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  style={{ width: '100%', height: '40px', fontSize: '14px' }}
                />
                <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2, marginTop: '6px' }}>
                  OpenAI API 或兼容的服务地址
                </div>
              </div>

              <div key="api-key-section">
                <Label required style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  API Key
                </Label>
                <Input
                  key="api-key-input-stable"
                  type="password"
                  value={aiApiKey}
                  onChange={handleApiKeyChange}
                  placeholder="sk-..."
                  style={{ width: '100%', height: '40px', fontSize: '14px' }}
                />
                <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2, marginTop: '6px' }}>
                  您的 API 密钥，将安全保存在本地浏览器
                </div>
              </div>

              <div key="model-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <Label required style={{ fontSize: '14px', fontWeight: '600' }}>
                    模型
                  </Label>
                  <Button
                    appearance="subtle"
                    size="small"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || !aiApiUrl || !aiApiKey}
                    style={{ height: '32px' }}
                  >
                    {fetchingModels ? '🔄 获取中...' : '🔄 获取模型列表'}
                  </Button>
                </div>
                
                {availableModels.length > 0 ? (
                  <Select
                    key="model-select-fetched"
                    value={aiModel}
                    onChange={handleModelChange}
                    style={{ width: '100%', height: '40px', fontSize: '14px' }}
                  >
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </Select>
                ) : (
                  <Select
                    key="model-select-default"
                    value={aiModel}
                    onChange={handleModelChange}
                    style={{ width: '100%', height: '40px', fontSize: '14px' }}
                  >
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                  </Select>
                )}
                <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground2, marginTop: '6px' }}>
                  {availableModels.length > 0 
                    ? `已获取 ${availableModels.length} 个可用模型`
                    : '点击"获取模型列表"按钮获取可用模型，或手动选择默认模型'}
                </div>
              </div>

              <MessageBar intent="info">
                <MessageBarBody>
                  💡 配置信息将保存在本地浏览器，不会上传到服务器。首次配置时会自动尝试获取模型列表（最多重试3次）。
                </MessageBarBody>
              </MessageBar>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={handleSkip}>
                暂时跳过
              </Button>
              <Button 
                appearance="primary" 
                onClick={handleSaveAndContinue}
                disabled={!aiApiUrl || !aiApiKey || !aiModel}
              >
                保存并继续
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default AIConfigCheckPage;
