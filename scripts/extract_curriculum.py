"""Extract semester data without modifying the source workbook. Usage: python script.py plan.xlsx"""
import json, sys
from pathlib import Path
import openpyxl
w=openpyxl.load_workbook(sys.argv[1],data_only=True)
s=w['ПланСвод']; p=w['План']
rows=list(s.iter_rows(values_only=True)); codes=[str(r[1]) for r in rows if r[1]]
subjects=[]
for rn,r in enumerate(rows,1):
 code=r[1]; name=r[2]
 if rn < 6 or not code or r[0] not in ('+','-') or any(c.startswith(str(code)+'.') for c in codes):continue
 semesters=[]
 for sem in range(1,9):
  credit=r[16+sem]
  hrs=sum(float(p.cell(rn,13+(sem-1)*4+j).value or 0) for j in range(4))
  if credit is not None or hrs:
   semesters.append({'semester':sem,'credits':float(credit or 0),'studyHours':hrs,'assessment':[label for col,label in [(3,'Экзамен'),(4,'Зачёт'),(5,'Зачёт с оценкой'),(6,'Курсовой проект'),(7,'Курсовая работа')] if str(sem) in str(r[col] or '')]})
 if not semesters:continue
 group='Общеобразовательный'
 if str(code).startswith('Б1.Б.02'):group='Фундаментальный'
 elif str(code).startswith('Б1.Б.03'):group='Базовый'
 elif str(code).startswith('Б1.В.02'):group='Профильный'
 elif str(code).startswith(('Б1.Б.04','Б1.В.01','Б2','Б3')):group='Проекты и практика'
 elif str(code).startswith('ФТД'):group='Факультативы'
 elif str(code).startswith('Б1.В.03'):group='Дополнительный'
 subjects.append({'id':code,'name':name.strip(),'group':group,'selected':r[0]=='+','choice':str(code).rsplit('.',1)[0] if '.ДВ.' in str(code) else None,'semesters':semesters,'credits':float(r[9] or 0),'hours':float(r[11] or 0),'sourceRow':rn,'department':r[26]})
lookup={x['name']:x['id'] for x in subjects}
pairs=[
('Математика','Вычислительная математика'),('Математика','Теория вероятностей,  математическая статистика и случайные процессы'),('Дискретная математика','Математическая логика и теория алгоритмов'),('Дискретная математика','Теория автоматов'),('Физика','Электротехника'),('Электротехника','Основы цифровой электроники'),('Электротехника','Схемотехника'),('Информатика','Организация ЭВМ и периферийные устройства'),('Программирование','Объектно-ориентированное программирование'),('Программирование','Базы данных'),('Программирование','Компьютерная графика'),('Объектно-ориентированное программирование','Web-программирование'),('Базы данных','Web-программирование'),('Теория автоматов','Трансляторы и программные системы'),('Математическая логика и теория алгоритмов','Трансляторы и программные системы'),('Организация ЭВМ и периферийные устройства','Операционные системы'),('Организация ЭВМ и периферийные устройства','Системы хранения данных'),('Операционные системы','Организация центров обработки данных'),('Системы хранения данных','Организация центров обработки данных'),('Организация ЭВМ и периферийные устройства','Сети и телекоммуникации'),('Сети и телекоммуникации','Защита информации'),('Сети и телекоммуникации','Технологии интернета вещей'),('Схемотехника','Технологии интернета вещей'),('Теория вероятностей,  математическая статистика и случайные процессы','Методы обработки данных'),('Методы обработки данных','Интеллектные вычислительные системы'),('Методы обработки данных','Обработка больших данных и распределенные вычисления'),('Организация центров обработки данных','Обработка больших данных и распределенные вычисления'),('Операционные системы','Администрирование Linux систем'),('Администрирование Linux систем','Безопасность Linux систем'),('Базы данных','Проектирование информационных систем'),('Объектно-ориентированное программирование','Технологии программирования'),('Организация ЭВМ и периферийные устройства','Машинно-ориентированные языки'),('Основы проектной деятельности','Проектная деятельность')]
edges=[{'from':lookup[a],'to':lookup[b],'status':'proposed'} for a,b in pairs]
data={'title':w['Титул']['D30'].value,'code':'09.03.01','year':w['Титул']['W40'].value,'sourceFile':Path(sys.argv[1]).name,'sourceSheet':'ПланСвод','filenameCohort':'ЭВМб-23','academicYear':'2022–2023','status':'Исходный план; принадлежность набору требует уточнения','subjects':subjects,'edges':edges,'semesterCredits':[float(x) for x in rows[92][17:25]],'note':'Семестры и названия взяты из учебного плана. Пунктирные связи — предложения для проверки руководителем программы, а не утверждённые пререквизиты.'}
out=Path(__file__).resolve().parents[1]/'js/data/evm-curriculum.json'
out.write_text(json.dumps(data,ensure_ascii=False,indent=2))
print(len(subjects),'subjects;',len(edges),'proposed edges')
