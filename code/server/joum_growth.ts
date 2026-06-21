// 연령별 자음 발달 단계 테이블 + 조회 함수.
//
// 출처: 참고_client/_Project/_Script/Data/DataMgr_Joum.cs 의 JoumGrowthAgeMgr.Create()
// (라인 1689-1721). 원본 값 그대로 포팅. [[feedback-client-joum-source-of-truth]]
//
// enum 순서대로 정수 값:
//   WANSEONG(완전습득)=0, SOOKDAL(숙달)=1, GWANSEB(관습적)=2, APPEAR(출현)=3

export const GROWTH = { WANSEONG: 0, SOOKDAL: 1, GWANSEB: 2, APPEAR: 3 } as const
export type GrowthGrade = 0 | 1 | 2 | 3

type Row = { age: number; grade: GrowthGrade; joums: string[] }

// JoumGrowthAgeMgr.Create() 의 데이터 (라인 1698-1721) 그대로
const TABLE: Row[] = [
  { age: 2, grade: GROWTH.WANSEONG, joums: ['ㅍ','ㅁ','ㅇ'] },
  { age: 2, grade: GROWTH.SOOKDAL,  joums: ['ㅂ','ㅃ','ㄴ','ㄷ','ㄸ','ㅌ','ㄱ','ㄲ','ㅋ','ㅎ'] },
  { age: 2, grade: GROWTH.GWANSEB,  joums: ['ㅈ','ㅉ','ㅊ'] },
  { age: 2, grade: GROWTH.APPEAR,   joums: ['ㅅ','ㅆ'] },

  { age: 3, grade: GROWTH.WANSEONG, joums: ['ㅍ','ㅁ','ㅇ','ㅂ','ㅃ','ㄸ','ㅌ','ㅎ','ㄴ','ㄷ'] },
  { age: 3, grade: GROWTH.SOOKDAL,  joums: ['ㅊ','ㄱ','ㄲ','ㅋ','ㅈ','ㅉ','ㅆ'] },
  { age: 3, grade: GROWTH.GWANSEB,  joums: ['ㅅ','ㄹ'] },
  { age: 3, grade: GROWTH.APPEAR,   joums: [] },

  { age: 4, grade: GROWTH.WANSEONG, joums: ['ㅍ','ㅁ','ㅇ','ㅂ','ㅃ','ㄸ','ㅌ','ㅎ','ㄴ','ㄲ','ㄷ','ㅊ','ㄱ','ㄹ'] },
  { age: 4, grade: GROWTH.SOOKDAL,  joums: ['ㅋ','ㅈ','ㅉ','ㅆ','ㅅ'] },
  { age: 4, grade: GROWTH.GWANSEB,  joums: [] },
  { age: 4, grade: GROWTH.APPEAR,   joums: [] },

  { age: 5, grade: GROWTH.WANSEONG, joums: ['ㅍ','ㅁ','ㅇ','ㅂ','ㅃ','ㄸ','ㅌ','ㅎ','ㄴ','ㄲ','ㄷ','ㅊ','ㄱ','ㅋ','ㅈ','ㅉ','ㅆ','ㄹ'] },
  { age: 5, grade: GROWTH.SOOKDAL,  joums: ['ㅅ'] },
  { age: 5, grade: GROWTH.GWANSEB,  joums: [] },
  { age: 5, grade: GROWTH.APPEAR,   joums: [] },

  { age: 6, grade: GROWTH.WANSEONG, joums: ['ㅍ','ㅁ','ㅇ','ㅂ','ㅃ','ㄸ','ㅌ','ㅎ','ㄴ','ㄲ','ㄷ','ㅊ','ㄱ','ㅋ','ㅈ','ㅉ','ㅆ','ㅅ','ㄹ'] },
  { age: 6, grade: GROWTH.SOOKDAL,  joums: [] },
  { age: 6, grade: GROWTH.GWANSEB,  joums: [] },
  { age: 6, grade: GROWTH.APPEAR,   joums: [] }
]

// 19 자음 전체 (PumsaMgr 와 무관, 단순 character set)
export const ALL_JOUMS_19 = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

// JoumGrowthAgeMgr.GetJoumGrowthPerAgeList(age, grade): 선택 grade "이하" 모든 단계 누적 반환.
// 즉 SOOKDAL 을 고르면 WANSEONG + SOOKDAL 의 자음들 합집합.
export function getMatureJoums(age: number, gradeMax: GrowthGrade): Set<string> {
  const ageClamped = Math.min(6, Math.max(2, age))
  const set = new Set<string>()
  for (const row of TABLE) {
    if (row.age === ageClamped && row.grade <= gradeMax) {
      for (const j of row.joums) set.add(j)
    }
  }
  return set
}

// FilterAdoptAge 의 "unusable" 자음 = 19자음 - 성숙한 자음
export function getUnusableJoums(age: number, gradeMax: GrowthGrade): Set<string> {
  const mature = getMatureJoums(age, gradeMax)
  const unusable = new Set<string>()
  for (const j of ALL_JOUMS_19) if (!mature.has(j)) unusable.add(j)
  return unusable
}

// 자음 발달 순위 (참고_client/doc/치료단어 알고리즘 정리_김덕규.txt 라인 16-22)
// 1순위 가장 쉬움, 6순위 가장 어려움. 목표조음 추천 우선순위에 사용.
const DEV_RANK: Record<string, number> = {
  'ㅍ': 1, 'ㅁ': 1, 'ㅇ': 1,
  'ㅂ': 2, 'ㅃ': 2, 'ㄸ': 2, 'ㅌ': 2, 'ㅎ': 2,
  'ㄴ': 3, 'ㄲ': 3, 'ㄷ': 3,
  'ㄱ': 4, 'ㅋ': 4, 'ㅈ': 4, 'ㅉ': 4, 'ㅊ': 4, 'ㅆ': 4,
  'ㅅ': 5,
  'ㄹ': 6
}
export function developmentRank(joum: string): number {
  return DEV_RANK[joum] ?? 99
}
