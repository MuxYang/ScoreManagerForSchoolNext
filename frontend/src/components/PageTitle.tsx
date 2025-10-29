import React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { Title2, Body1 } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    marginBottom: '24px',
    '@media (max-width: 768px)': {
      marginBottom: '16px',
    },
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    margin: 0,
    '@media (max-width: 768px)': {
      fontSize: '20px',
    },
  },
  subtitle: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    marginTop: '4px',
    margin: 0,
    '@media (max-width: 768px)': {
      fontSize: '13px',
    },
  },
});

interface PageTitleProps {
  title: string;
  subtitle?: string;
}

const PageTitle: React.FC<PageTitleProps> = ({ title, subtitle }) => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Title2 className={styles.title}>{title}</Title2>
      {subtitle && <Body1 className={styles.subtitle}>{subtitle}</Body1>}
    </div>
  );
};

export default PageTitle;
