import React, { useState, useEffect } from 'react';
import {
  Card,
  Title1,
  Title2,
  Title3,
  Body1,
  makeStyles,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from '@fluentui/react-components';
import {
  PeopleRegular,
  PersonRegular,
  TrophyRegular,
  CheckmarkCircleRegular,
  ClockRegular,
} from '@fluentui/react-icons';
import { scoreAPI } from '../services/api';

const useStyles = makeStyles({
  container: {
    padding: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  statsCard: {
    padding: '24px',
    textAlign: 'center',
    cursor: 'default',
  },
  statsIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  statsValue: {
    fontSize: '36px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  statsLabel: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
  },
  section: {
    marginBottom: '32px',
  },
  rankingCard: {
    marginBottom: '16px',
  },
  rankBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontWeight: '600',
    fontSize: '14px',
    marginRight: '12px',
  },
  rank1: {
    backgroundColor: tokens.colorPaletteGoldBackground2,
    color: tokens.colorPaletteGoldForeground2,
  },
  rank2: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  rank3: {
    backgroundColor: tokens.colorPaletteBrownBackground2,
    color: tokens.colorPaletteBrownForeground2,
  },
  rankOther: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
  },
  tableContainer: {
    overflowX: 'auto',
  },
});

interface DashboardStats {
  studentCount: number;
  teacherCount: number;
  scoreCount: number;
  qualifiedCount: number;
  qualifiedStudents: any[];
  topRankings: any[];
  recentScores: any[];
}

const HomePage: React.FC = () => {
  const styles = useStyles();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await scoreAPI.getDashboardStats();
      setStats(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spinner label="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const getRankBadgeClass = (index: number) => {
    if (index === 0) return `${styles.rankBadge} ${styles.rank1}`;
    if (index === 1) return `${styles.rankBadge} ${styles.rank2}`;
    if (index === 2) return `${styles.rankBadge} ${styles.rank3}`;
    return `${styles.rankBadge} ${styles.rankOther}`;
  };

  return (
    <div className={styles.container}>
      <Title1 style={{ marginBottom: '24px' }}>📊 数据概览</Title1>

      {/* 统计卡片 */}
      <div className={styles.statsGrid}>
        <Card className={styles.statsCard}>
          <PeopleRegular className={styles.statsIcon} style={{ color: tokens.colorPaletteBlueForeground2 }} />
          <div className={styles.statsValue}>{stats.studentCount}</div>
          <div className={styles.statsLabel}>学生总数</div>
        </Card>

        <Card className={styles.statsCard}>
          <PersonRegular className={styles.statsIcon} style={{ color: tokens.colorPaletteGreenForeground2 }} />
          <div className={styles.statsValue}>{stats.teacherCount}</div>
          <div className={styles.statsLabel}>教师总数</div>
        </Card>

        <Card className={styles.statsCard}>
          <TrophyRegular className={styles.statsIcon} style={{ color: tokens.colorPaletteGoldForeground2 }} />
          <div className={styles.statsValue}>{stats.scoreCount}</div>
          <div className={styles.statsLabel}>积分记录</div>
        </Card>

        <Card className={styles.statsCard}>
          <CheckmarkCircleRegular className={styles.statsIcon} style={{ color: tokens.colorPalettePurpleForeground2 }} />
          <div className={styles.statsValue}>{stats.qualifiedCount}</div>
          <div className={styles.statsLabel}>达标人数 (≥6分)</div>
        </Card>
      </div>

      {/* 积分排名 */}
      <div className={styles.section}>
        <Title2 style={{ marginBottom: '16px' }}>🏆 积分排名 TOP 10</Title2>
        <Card>
          <div style={{ padding: '16px' }}>
            {stats.topRankings.length === 0 ? (
              <Body1 style={{ textAlign: 'center', color: tokens.colorNeutralForeground3, padding: '20px' }}>
                暂无数据
              </Body1>
            ) : (
              <div>
                {stats.topRankings.map((student, index) => (
                  <div
                    key={student.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      borderBottom: index < stats.topRankings.length - 1 ? `1px solid ${tokens.colorNeutralStroke2}` : 'none',
                    }}
                  >
                    <div className={getRankBadgeClass(index)}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '15px' }}>
                        {student.name} ({student.student_id})
                      </div>
                      <div style={{ fontSize: '13px', color: tokens.colorNeutralForeground3 }}>
                        {student.class}
                      </div>
                    </div>
                    <div>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '20px',
                        color: student.total_points >= 6 ? tokens.colorPaletteGreenForeground2 : tokens.colorNeutralForeground1
                      }}>
                        {student.total_points} 分
                      </div>
                      <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3, textAlign: 'right' }}>
                        {student.record_count} 条记录
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 达标学生列表 */}
      <div className={styles.section}>
        <Title2 style={{ marginBottom: '16px' }}>✅ 达标学生列表 (≥6分)</Title2>
        <Card>
          <div style={{ padding: '16px' }}>
            {stats.qualifiedStudents.length === 0 ? (
              <Body1 style={{ textAlign: 'center', color: tokens.colorNeutralForeground3, padding: '20px' }}>
                暂无达标学生
              </Body1>
            ) : (
              <div className={styles.tableContainer}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>排名</TableHeaderCell>
                      <TableHeaderCell>姓名</TableHeaderCell>
                      <TableHeaderCell>学号</TableHeaderCell>
                      <TableHeaderCell>班级</TableHeaderCell>
                      <TableHeaderCell>总积分</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.qualifiedStudents.map((student, index) => (
                      <TableRow key={student.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{student.class}</TableCell>
                        <TableCell>
                          <span style={{ 
                            fontWeight: '600',
                            color: tokens.colorPaletteGreenForeground2
                          }}>
                            {student.total_points} 分
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 最近积分记录 */}
      <div className={styles.section}>
        <Title2 style={{ marginBottom: '16px' }}>
          <ClockRegular style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          最近积分记录
        </Title2>
        <Card>
          <div style={{ padding: '16px' }}>
            {stats.recentScores.length === 0 ? (
              <Body1 style={{ textAlign: 'center', color: tokens.colorNeutralForeground3, padding: '20px' }}>
                暂无记录
              </Body1>
            ) : (
              <div className={styles.tableContainer}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>学生</TableHeaderCell>
                      <TableHeaderCell>学号</TableHeaderCell>
                      <TableHeaderCell>班级</TableHeaderCell>
                      <TableHeaderCell>积分</TableHeaderCell>
                      <TableHeaderCell>事由</TableHeaderCell>
                      <TableHeaderCell>教师</TableHeaderCell>
                      <TableHeaderCell>日期</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentScores.map((score: any) => (
                      <TableRow key={score.id}>
                        <TableCell>{score.student_name}</TableCell>
                        <TableCell>{score.student_number}</TableCell>
                        <TableCell>{score.class}</TableCell>
                        <TableCell>
                          <span style={{
                            fontWeight: '600',
                            color: score.points > 0 ? tokens.colorPaletteGreenForeground2 : tokens.colorPaletteRedForeground2
                          }}>
                            {score.points > 0 ? '+' : ''}{score.points}
                          </span>
                        </TableCell>
                        <TableCell>{score.reason || '-'}</TableCell>
                        <TableCell>{score.teacher_name || '-'}</TableCell>
                        <TableCell>{score.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HomePage;
