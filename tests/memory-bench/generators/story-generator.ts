export interface Character {
  id: string
  name: string
  age: number
  occupation: string
  hairColour: string
  city: string
  personality: string[]
}

export interface Relationship {
  sourceId: string
  targetId: string
  type: "friend" | "colleague" | "sibling" | "partner"
  since: string
}

export interface Fact {
  id: string
  characterId: string
  attribute: string
  value: string
  timestamp: string
  supersedesFactId?: string
}

export interface TestCase {
  id: string
  type: "attribute" | "relationship" | "temporal" | "knowledge-update" | "abstention" | "multi-hop"
  question: string
  expectedAnswer: string
  evidenceFacts: string[]
  distractorFacts: string[]
}

export interface Story {
  seed: number
  characters: Character[]
  facts: Fact[]
  testCases: TestCase[]
}

const NAME_POOL = [
  "Ava",
  "Miles",
  "Nadia",
  "Theo",
  "Priya",
  "Jonah",
  "Lina",
  "Owen",
  "Zara",
  "Felix",
] as const

const OCCUPATION_POOL = [
  "product designer",
  "site reliability engineer",
  "data analyst",
  "security architect",
  "technical writer",
  "customer researcher",
  "platform engineer",
  "solutions consultant",
] as const

const HAIR_COLOUR_POOL = ["auburn", "black", "brown", "blonde", "silver", "copper"] as const

const CITY_POOL = [
  "Cape Town",
  "Berlin",
  "Toronto",
  "Lisbon",
  "Nairobi",
  "Seoul",
  "Melbourne",
  "Dublin",
] as const

const PERSONALITY_POOL = [
  "curious",
  "patient",
  "meticulous",
  "optimistic",
  "decisive",
  "witty",
  "observant",
  "calm",
] as const

const RELATIONSHIP_TYPES = ["friend", "colleague", "sibling", "partner"] as const

const DAY_MS = 24 * 60 * 60 * 1000

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index]
    const replacement = copy[swapIndex]
    if (current === undefined || replacement === undefined) {
      continue
    }
    copy[index] = replacement
    copy[swapIndex] = current
  }
  return copy
}

function formatDate(timestamp: string): string {
  return timestamp.slice(0, 10)
}

function normalizeQuestionText(text: string): string {
  return text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
}

function attributeLabel(attribute: string): string {
  if (attribute === "hairColour") return "hair colour"
  return attribute.replace(/-/g, " ")
}

function buildId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(2, "0")}`
}

function buildTimestampFactory(seed: number): () => string {
  const base = Date.UTC(2024, 0, 1, 9, 0, 0) + seed * 1000
  let step = 0
  return () => new Date(base + step++ * DAY_MS).toISOString()
}

function getCharacterName(characterId: string, characters: Character[]): string {
  const match = characters.find((character) => character.id === characterId)
  return match?.name ?? characterId
}

function pickDifferent(currentValue: string, values: readonly string[], random: () => number): string {
  const options = values.filter((value) => value !== currentValue)
  if (options.length === 0) return currentValue
  const index = Math.floor(random() * options.length)
  return options[index] ?? currentValue
}

export function renderFactText(fact: Fact, characters: Character[]): string {
  const characterName = getCharacterName(fact.characterId, characters)
  const date = formatDate(fact.timestamp)

  if (fact.attribute.startsWith("relationship:")) {
    const [, targetId] = fact.attribute.split(":")
    const targetName = targetId ? getCharacterName(targetId, characters) : "unknown"
    const [relationshipType, since] = fact.value.split("|")
    const sinceDate = since ? formatDate(since) : date
    return `On ${date}, ${characterName} is ${targetName}'s ${relationshipType ?? "contact"} since ${sinceDate}.`
  }

  if (fact.attribute.startsWith("multi-hop:")) {
    const [targetName, relationshipType, detailKind, detailValue] = fact.value.split("|")
    const label = detailKind === "city" ? "lives in" : "works as"
    return `On ${date}, ${characterName}'s ${relationshipType ?? "contact"} ${targetName ?? "unknown"} ${label} ${detailValue ?? "unknown"}.`
  }

  return `On ${date}, ${characterName}'s ${attributeLabel(fact.attribute)} is ${fact.value}.`
}

export function generateStory(
  seed: number,
  numCharacters: number,
  numRelationships: number,
  numLocations: number,
): Story {
  const random = mulberry32(seed)
  const nextTimestamp = buildTimestampFactory(seed)
  const cityChoices = shuffle(CITY_POOL, random).slice(0, Math.max(1, numLocations))
  const names = shuffle(NAME_POOL, random)
  const occupations = shuffle(OCCUPATION_POOL, random)
  const hairColours = shuffle(HAIR_COLOUR_POOL, random)
  const personalityTraits = shuffle(PERSONALITY_POOL, random)

  const characters: Character[] = []
  for (let index = 0; index < numCharacters; index += 1) {
    const name = names[index % names.length] ?? `Person ${index + 1}`
    const occupation = occupations[index % occupations.length] ?? "operator"
    const hairColour = hairColours[index % hairColours.length] ?? "brown"
    const city = cityChoices[index % cityChoices.length] ?? CITY_POOL[0]
    const traitA = personalityTraits[index % personalityTraits.length] ?? "curious"
    const traitB = personalityTraits[(index + 3) % personalityTraits.length] ?? "patient"

    characters.push({
      id: buildId("char", index),
      name,
      age: 26 + ((seed + index * 7) % 15),
      occupation,
      hairColour,
      city,
      personality: [traitA, traitB],
    })
  }

  const relationships: Relationship[] = []
  const relationshipPairs: Array<{ sourceId: string; targetId: string }> = []
  for (let sourceIndex = 0; sourceIndex < characters.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < characters.length; targetIndex += 1) {
      const source = characters[sourceIndex]
      const target = characters[targetIndex]
      if (source && target) {
        relationshipPairs.push({ sourceId: source.id, targetId: target.id })
      }
    }
  }

  const shuffledPairs = shuffle(relationshipPairs, random)
  const relationshipCount = Math.min(numRelationships, shuffledPairs.length)
  for (let index = 0; index < relationshipCount; index += 1) {
    const pair = shuffledPairs[index]
    if (!pair) continue
    const relationshipType = RELATIONSHIP_TYPES[index % RELATIONSHIP_TYPES.length] ?? "friend"
    relationships.push({
      sourceId: pair.sourceId,
      targetId: pair.targetId,
      type: relationshipType,
      since: nextTimestamp(),
    })
  }

  const facts: Fact[] = []
  const cityFacts: Fact[] = []
  const occupationFacts: Fact[] = []
  const hairFacts: Fact[] = []
  const relationshipFacts: Fact[] = []
  const temporalFacts: Fact[] = []
  const knowledgeUpdateFacts: Fact[] = []
  const multiHopFacts: Fact[] = []

  function addFact(characterId: string, attribute: string, value: string, supersedesFactId?: string): Fact {
    const fact: Fact = {
      id: buildId("fact", facts.length),
      characterId,
      attribute,
      value,
      timestamp: nextTimestamp(),
      ...(supersedesFactId ? { supersedesFactId } : {}),
    }
    facts.push(fact)
    return fact
  }

  for (const character of characters) {
    addFact(character.id, "age", String(character.age))
    const occupationFact = addFact(character.id, "occupation", character.occupation)
    const hairFact = addFact(character.id, "hairColour", character.hairColour)
    const cityFact = addFact(character.id, "city", character.city)
    occupationFacts.push(occupationFact)
    hairFacts.push(hairFact)
    cityFacts.push(cityFact)
  }

  for (const relationship of relationships) {
    const relationshipFact = addFact(
      relationship.sourceId,
      `relationship:${relationship.targetId}`,
      `${relationship.type}|${relationship.since}`,
    )
    relationshipFacts.push(relationshipFact)
  }

  const firstCharacter = characters[0]
  const secondCharacter = characters[1] ?? characters[0]
  const firstCityFact = firstCharacter ? cityFacts.find((fact) => fact.characterId === firstCharacter.id) : undefined
  const secondOccupationFact = secondCharacter
    ? occupationFacts.find((fact) => fact.characterId === secondCharacter.id)
    : undefined

  if (firstCharacter && firstCityFact) {
    temporalFacts.push(firstCityFact)
    const updatedCity = pickDifferent(firstCharacter.city, CITY_POOL, random)
    const cityUpdate = addFact(firstCharacter.id, "city", updatedCity, firstCityFact.id)
    knowledgeUpdateFacts.push(cityUpdate)
    firstCharacter.city = updatedCity
  }

  if (secondCharacter && secondOccupationFact) {
    temporalFacts.push(secondOccupationFact)
    const updatedOccupation = pickDifferent(secondCharacter.occupation, OCCUPATION_POOL, random)
    const occupationUpdate = addFact(secondCharacter.id, "occupation", updatedOccupation, secondOccupationFact.id)
    knowledgeUpdateFacts.push(occupationUpdate)
    secondCharacter.occupation = updatedOccupation
  }

  const relationshipForSummaryA = relationships[0]
  const relationshipForSummaryB = relationships[1] ?? relationships[0]
  const summaryRelationships = [relationshipForSummaryA, relationshipForSummaryB].filter(
    (relationship): relationship is Relationship => relationship !== undefined,
  )

  for (const relationship of summaryRelationships) {
    const target = characters.find((character) => character.id === relationship.targetId)
    if (!target) continue
    const detailKind = multiHopFacts.length === 0 ? "occupation" : "city"
    const detailValue = detailKind === "occupation" ? target.occupation : target.city
    const summaryFact = addFact(
      relationship.sourceId,
      `multi-hop:${relationship.targetId}`,
      `${target.name}|${relationship.type}|${detailKind}|${detailValue}`,
    )
    multiHopFacts.push(summaryFact)
  }

  const testCases: TestCase[] = []

  function pickDistractors(sourceFacts: Fact[], currentFactIds: readonly string[]): string[] {
    const blocked = new Set(currentFactIds)
    const distractors: string[] = []
    for (const candidate of sourceFacts) {
      if (blocked.has(candidate.id)) continue
      distractors.push(candidate.id)
      if (distractors.length === 2) break
    }
    return distractors
  }

  function addFactBackedTestCase(type: TestCase["type"], fact: Fact, evidenceFacts: string[], distractorPool: Fact[]): void {
    const question = normalizeQuestionText(renderFactText(fact, characters))
    testCases.push({
      id: buildId("case", testCases.length),
      type,
      question,
      expectedAnswer: renderFactText(fact, characters),
      evidenceFacts,
      distractorFacts: pickDistractors(distractorPool, evidenceFacts),
    })
  }

  const attributeCaseFacts = [hairFacts[0], occupationFacts[2] ?? occupationFacts[0]].filter(
    (fact): fact is Fact => fact !== undefined,
  )
  for (const fact of attributeCaseFacts) {
    addFactBackedTestCase("attribute", fact, [fact.id], facts)
  }

  const relationshipCaseFacts = [relationshipFacts[0], relationshipFacts[1] ?? relationshipFacts[0]].filter(
    (fact): fact is Fact => fact !== undefined,
  )
  for (const fact of relationshipCaseFacts) {
    addFactBackedTestCase("relationship", fact, [fact.id], relationshipFacts)
  }

  const temporalCaseFacts = [temporalFacts[0], temporalFacts[1] ?? temporalFacts[0]].filter(
    (fact): fact is Fact => fact !== undefined,
  )
  for (const fact of temporalCaseFacts) {
    addFactBackedTestCase("temporal", fact, [fact.id], temporalFacts)
  }

  const knowledgeCaseFacts = [knowledgeUpdateFacts[0], knowledgeUpdateFacts[1] ?? knowledgeUpdateFacts[0]].filter(
    (fact): fact is Fact => fact !== undefined,
  )
  for (const fact of knowledgeCaseFacts) {
    const evidence = fact.supersedesFactId ? [fact.id, fact.supersedesFactId] : [fact.id]
    addFactBackedTestCase("knowledge-update", fact, evidence, knowledgeUpdateFacts)
  }

  const multiHopCaseFacts = [multiHopFacts[0], multiHopFacts[1] ?? multiHopFacts[0]].filter(
    (fact): fact is Fact => fact !== undefined,
  )
  for (const fact of multiHopCaseFacts) {
    const evidence = [fact.id]
    const relatedCharacterId = fact.attribute.split(":")[1]
    const detailCharacter = relatedCharacterId
      ? characters.find((character) => character.id === relatedCharacterId)
      : undefined
    const detailFact = detailCharacter
      ? facts.find((candidate) => {
        return candidate.characterId === detailCharacter.id && (candidate.attribute === "occupation" || candidate.attribute === "city")
      })
      : undefined
    if (detailFact) evidence.push(detailFact.id)
    addFactBackedTestCase("multi-hop", fact, evidence, multiHopFacts)
  }

  const abstentionQuestions = [
    "Zelda moonbase occupation",
    "Phantom neon-harbor sibling",
  ]
  for (const question of abstentionQuestions) {
    testCases.push({
      id: buildId("case", testCases.length),
      type: "abstention",
      question,
      expectedAnswer: "",
      evidenceFacts: [],
      distractorFacts: pickDistractors(facts, []),
    })
  }

  return {
    seed,
    characters,
    facts,
    testCases,
  }
}
