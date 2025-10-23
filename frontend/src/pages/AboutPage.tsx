import React from 'react';
import {
  Card,
  Title1,
  Title2,
  Body1,
  Link,
  makeStyles,
  tokens,
  Divider,
} from '@fluentui/react-components';
import {
  CodeRegular,
  PersonRegular,
  ShieldCheckmarkRegular,
  DocumentRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    padding: '32px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  section: {
    marginBottom: '32px',
  },
  infoCard: {
    padding: '24px',
    marginBottom: '16px',
  },
  iconHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  linkButton: {
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    fontSize: '16px',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  licenseBox: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '13px',
    marginTop: '12px',
  },
});

// License and disclaimer text (obfuscated)
const getLicenseText = (): string => {
  const e = [
    "\u6B64\u4EA7\u54C1\u4E3A\u975E\u5546\u7528\u534F\u8BAE\uFF0C",
    "\u4E14\u65E0\u8BBA\u60A8\u5982\u4F55\u4FEE\u6539\u672C\u7F51\u7AD9\uFF0C\u5E94\u5F53\u5F00\u6E90\uFF1B",
    "\u5982\u679C\u60A8\u5BF9\u672C\u7F51\u7AD9\u4FEE\u6539\u540E\u5B9E\u884C\u6536\u8D39\u5206\u53D1\uFF0C",
    "\u5373\u4EE3\u8868\u60A8\u6709\u5BF9\u4E8E\u672C\u7F51\u7AD9\u7684\u7EF4\u62A4\u8D23\u4EFB\u3002"
  ];
  return e.join('\n');
};

// Encoded project info
const getProjectInfo = () => {
  const a = String.fromCharCode(77, 117, 120, 89, 97, 110, 103);
  const b = 'https://github.com/MuxYang/ScoreManagerForSchoolNext';
  const c = 'GPL-v3';
  return { author: a, repo: b, license: c };
};

const AboutPage: React.FC = () => {
  const styles = useStyles();
  const info = getProjectInfo();

  return (
    <div className={styles.container}>
      <Title1 style={{ marginBottom: '32px', textAlign: 'center' }}>
        关于 · 学生量化统计系统
      </Title1>

      {/* 作者信息 */}
      <div className={styles.section}>
        <Card className={styles.infoCard}>
          <div className={styles.iconHeader}>
            <PersonRegular style={{ fontSize: '24px', color: tokens.colorBrandForeground1 }} />
            <Title2>作者</Title2>
          </div>
          <Body1 style={{ fontSize: '18px', fontWeight: '600' }}>{info.author}</Body1>
          <Body1 style={{ marginTop: '8px', color: tokens.colorNeutralForeground3 }}>
            全栈开发者 · 教育技术爱好者
          </Body1>
        </Card>
      </div>

      {/* 开源信息 */}
      <div className={styles.section}>
        <Card className={styles.infoCard}>
          <div className={styles.iconHeader}>
            <CodeRegular style={{ fontSize: '24px', color: tokens.colorBrandForeground1 }} />
            <Title2>开源项目</Title2>
          </div>
          <Body1 style={{ marginBottom: '12px' }}>
            本项目已在 GitHub 上开源，欢迎贡献代码或提出建议！
          </Body1>
          <Link 
            href={info.repo} 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.linkButton}
          >
            🔗 {info.repo}
          </Link>
        </Card>
      </div>

      {/* 开源协议 */}
      <div className={styles.section}>
        <Card className={styles.infoCard}>
          <div className={styles.iconHeader}>
            <DocumentRegular style={{ fontSize: '24px', color: tokens.colorBrandForeground1 }} />
            <Title2>开源协议</Title2>
          </div>
          <Body1 style={{ marginBottom: '12px' }}>
            本项目采用 <strong>{info.license}</strong> 协议开源
          </Body1>
          <Body1 style={{ color: tokens.colorNeutralForeground3, lineHeight: '1.6' }}>
            GNU通用公共许可证（General Public License, GPL）是一个广泛使用的自由软件许可证，
            它保证终端用户拥有运行、学习、共享和修改软件的自由。
          </Body1>
          <div className={styles.licenseBox}>
            <code>License: GNU General Public License v3.0</code>
          </div>
        </Card>
      </div>

      {/* 使用声明 */}
      <div className={styles.section}>
        <Card className={styles.infoCard}>
          <div className={styles.iconHeader}>
            <ShieldCheckmarkRegular style={{ fontSize: '24px', color: tokens.colorPaletteRedForeground2 }} />
            <Title2>使用声明</Title2>
          </div>
          <Body1 style={{ marginBottom: '16px', color: tokens.colorNeutralForeground2, lineHeight: '1.8' }}>
            {getLicenseText().split('\n').map((line, index) => (
              <div key={index} style={{ marginBottom: '8px' }}>
                {line}
              </div>
            ))}
          </Body1>
          <Divider style={{ margin: '16px 0' }} />
          <Body1 style={{ fontSize: '13px', color: tokens.colorNeutralForeground3, fontStyle: 'italic' }}>
            本声明是软件协议的一部分，使用本软件即表示您同意遵守以上条款。
          </Body1>
        </Card>
      </div>

      {/* 版本信息 */}
      <div style={{ textAlign: 'center', marginTop: '48px', paddingBottom: '32px' }}>
        <Body1 style={{ color: tokens.colorNeutralForeground3, fontSize: '14px' }}>
          © 2024 {info.author} · Version 2.0.0-beta
        </Body1>
        <Body1 style={{ color: tokens.colorNeutralForeground3, fontSize: '12px', marginTop: '8px' }}>
          Built with React + TypeScript + Express + SQLite
        </Body1>
      </div>
    </div>
  );
};

export default AboutPage;

