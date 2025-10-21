import pinyin from 'pinyin';

/**
 * 标准化班级名称
 * 将各种班级表示法统一为标准格式
 * 例如: "1班", "一班", "01班" -> "1班"
 */
export function normalizeClassName(className: string): string {
  if (!className) return '';
  
  const trimmed = className.toString().trim();
  
  // 中文数字映射
  const chineseNumbers: { [key: string]: string } = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
    '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15',
    '十六': '16', '十七': '17', '十八': '18', '十九': '19', '二十': '20',
  };
  
  // 尝试匹配 "一班"、"1班"、"01班" 等格式
  const match = trimmed.match(/^([一二三四五六七八九十]+|[\d]+)班?$/);
  if (match) {
    const num = match[1];
    // 如果是中文数字，转换为阿拉伯数字
    if (chineseNumbers[num]) {
      return chineseNumbers[num] + '班';
    }
    // 如果是阿拉伯数字，去除前导零
    return parseInt(num, 10) + '班';
  }
  
  return trimmed;
}

/**
 * 将文本转换为拼音（无声调）
 */
export function toPinyin(text: string): string {
  if (!text) return '';
  return pinyin(text, {
    style: pinyin.STYLE_NORMAL, // 无声调
    heteronym: false // 不显示多音字
  }).flat().join('').toLowerCase();
}

/**
 * 拼音模糊匹配
 * 检查两个字符串是否拼音相同或相似
 */
export function fuzzyMatchPinyin(str1: string, str2: string): boolean {
  if (!str1 || !str2) return false;
  
  // 标准化并转拼音
  const pinyin1 = toPinyin(str1.trim());
  const pinyin2 = toPinyin(str2.trim());
  
  // 完全匹配
  if (pinyin1 === pinyin2) return true;
  
  // 原文匹配
  if (str1.trim() === str2.trim()) return true;
  
  return false;
}

/**
 * 查找拼音匹配的学生
 * @param db 数据库连接
 * @param name 学生姓名
 * @param className 班级名称
 * @returns 匹配的学生ID或null
 */
export function findStudentByPinyin(db: any, name: string, className: string): number | null {
  try {
    const normalizedClass = normalizeClassName(className);
    
    // 先尝试精确匹配
    const exactMatch = db.prepare(`
      SELECT id FROM students WHERE name = ? AND class = ?
    `).get(name, normalizedClass);
    
    if (exactMatch) return exactMatch.id;
    
    // 尝试拼音匹配
    const allStudents = db.prepare(`
      SELECT id, name, class FROM students
    `).all();
    
    for (const student of allStudents) {
      const studentClassNormalized = normalizeClassName(student.class);
      if (fuzzyMatchPinyin(student.name, name) && 
          studentClassNormalized === normalizedClass) {
        return student.id;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding student by pinyin:', error);
    return null;
  }
}

/**
 * 查找拼音匹配的教师
 * @param db 数据库连接
 * @param name 教师姓名
 * @returns 匹配的教师名称或原名称
 */
export function findTeacherByPinyin(db: any, name: string): string {
  try {
    // 先尝试精确匹配
    const exactMatch = db.prepare(`
      SELECT name FROM teachers WHERE name = ?
    `).get(name);
    
    if (exactMatch) return exactMatch.name;
    
    // 尝试拼音匹配
    const allTeachers = db.prepare(`
      SELECT DISTINCT name FROM teachers
    `).all();
    
    for (const teacher of allTeachers) {
      if (fuzzyMatchPinyin(teacher.name, name)) {
        return teacher.name;
      }
    }
    
    // 如果没有匹配，返回原名称
    return name;
  } catch (error) {
    console.error('Error finding teacher by pinyin:', error);
    return name;
  }
}

/**
 * 标准化任教班级列表
 * @param classesStr 班级字符串，例如 "1班;2班" 或 "一班,二班" 或 "1,2,3" 或 "1，2，3"（中文逗号）
 * @returns 标准化后的班级字符串
 */
export function normalizeTeachingClasses(classesStr: string): string {
  if (!classesStr) return '';
  
  const input = classesStr.toString().trim();
  if (!input) return '';
  
  // 统一分隔符：支持分号、英文逗号、中文逗号、顿号、空格等
  const classes = input
    .replace(/[；，、\s]+/g, ';')  // 中文分号、中文逗号、顿号、空格 → 分号
    .replace(/,/g, ';')            // 英文逗号 → 分号
    .split(';')
    .map(c => c.trim())
    .filter(c => c)
    .map(c => {
      // 如果只是数字（如 "1", "2", "3"），自动添加"班"
      if (/^\d+$/.test(c)) {
        return c + '班';
      }
      return normalizeClassName(c);
    })
    .filter(c => c && c !== '班'); // 过滤掉空值和只有"班"的情况
  
  // 如果处理后为空，返回空字符串
  if (classes.length === 0) {
    return '';
  }
  
  // 去重并排序
  const uniqueClasses = Array.from(new Set(classes));
  uniqueClasses.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });
  
  return uniqueClasses.join(';');
}

/**
 * 智能匹配学生信息
 * 根据姓名和班级尝试从数据库中匹配已存在的学生，自动填充学号等信息
 * @param db 数据库连接
 * @param name 学生姓名
 * @param className 班级名称
 * @param studentId 可选的学号
 * @returns 匹配结果 { matched: boolean, student?: { id, student_id, name, class } }
 */
export function matchStudentInfo(
  db: any, 
  name: string, 
  className?: string, 
  studentId?: string
): { matched: boolean; student?: any } {
  try {
    if (!name) {
      return { matched: false };
    }

    const normalizedClass = className ? normalizeClassName(className) : null;
    
    // 1. 如果提供了学号，先尝试学号精确匹配
    if (studentId) {
      const byStudentId = db.prepare(`
        SELECT id, student_id, name, class FROM students WHERE student_id = ?
      `).get(studentId);
      
      if (byStudentId) {
        return { matched: true, student: byStudentId };
      }
    }
    
    // 2. 尝试姓名+班级精确匹配
    if (normalizedClass) {
      const exactMatch = db.prepare(`
        SELECT id, student_id, name, class FROM students 
        WHERE name = ? AND class = ?
      `).get(name, normalizedClass);
      
      if (exactMatch) {
        return { matched: true, student: exactMatch };
      }
    }
    
    // 3. 尝试拼音+班级匹配
    if (normalizedClass) {
      const allStudents = db.prepare(`
        SELECT id, student_id, name, class FROM students WHERE class = ?
      `).all(normalizedClass);
      
      for (const student of allStudents) {
        if (fuzzyMatchPinyin(student.name, name)) {
          return { matched: true, student };
        }
      }
    }
    
    // 4. 只通过姓名精确匹配（可能有多个同名学生）
    const byName = db.prepare(`
      SELECT id, student_id, name, class FROM students WHERE name = ?
    `).all(name);
    
    if (byName.length === 1) {
      return { matched: true, student: byName[0] };
    }
    
    return { matched: false };
  } catch (error) {
    console.error('Error matching student info:', error);
    return { matched: false };
  }
}

/**
 * 智能匹配教师和科目
 * 根据教师姓名、班级和科目进行智能匹配
 * @param db 数据库连接
 * @param teacherName 教师姓名（可选）
 * @param className 班级名称（可选）
 * @param subject 科目名称（可选）
 * @returns 匹配结果 { teacher?: string, subject?: string }
 */
export function matchTeacherAndSubject(
  db: any,
  teacherName?: string,
  className?: string,
  subject?: string
): { teacher?: string; subject?: string } {
  try {
    const normalizedClass = className ? normalizeClassName(className) : null;
    
    // 1. 如果提供了教师和班级，尝试匹配科目
    if (teacherName && normalizedClass && !subject) {
      // 查找该教师在该班级教的科目
      const matchedSubject = db.prepare(`
        SELECT DISTINCT subject FROM teachers 
        WHERE name = ? AND teaching_classes LIKE ?
      `).get(teacherName, `%${normalizedClass}%`);
      
      if (matchedSubject) {
        return { teacher: teacherName, subject: matchedSubject.subject };
      }
      
      // 尝试拼音匹配教师
      const allTeachers = db.prepare(`
        SELECT DISTINCT name, subject, teaching_classes FROM teachers
      `).all();
      
      for (const teacher of allTeachers) {
        if (fuzzyMatchPinyin(teacher.name, teacherName) && 
            teacher.teaching_classes.includes(normalizedClass)) {
          return { teacher: teacher.name, subject: teacher.subject };
        }
      }
    }
    
    // 2. 如果提供了班级和科目，尝试匹配教师
    if (normalizedClass && subject && !teacherName) {
      const matchedTeacher = db.prepare(`
        SELECT DISTINCT name FROM teachers 
        WHERE subject = ? AND teaching_classes LIKE ?
      `).get(subject, `%${normalizedClass}%`);
      
      if (matchedTeacher) {
        return { teacher: matchedTeacher.name, subject };
      }
    }
    
    // 3. 如果提供了教师，尝试拼音匹配并返回标准名称
    if (teacherName) {
      const standardName = findTeacherByPinyin(db, teacherName);
      if (standardName !== teacherName) {
        // 找到了匹配的教师，获取其科目信息
        const teacherInfo = db.prepare(`
          SELECT DISTINCT subject FROM teachers WHERE name = ?
        `).get(standardName);
        
        return { 
          teacher: standardName, 
          subject: subject || teacherInfo?.subject 
        };
      }
    }
    
    // 返回原始值或 undefined
    return { 
      teacher: teacherName, 
      subject 
    };
  } catch (error) {
    console.error('Error matching teacher and subject:', error);
    return { teacher: teacherName, subject };
  }
}
