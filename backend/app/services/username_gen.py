import random

ADJECTIVES = [
    "Silent", "Hidden", "Iron", "Mountain", "Night", "Quiet", "Rogue", "Swift",
    "Lone", "Ember", "Frost", "Shadow", "Golden", "Crimson", "Wild", "Ancient",
    "Drifting", "Restless", "Stray", "Winter",
]

NOUNS = [
    "Wolf", "Leaf", "Owl", "Fox", "Traveler", "Falcon", "Raven", "Otter",
    "Bear", "Sparrow", "Hawk", "Badger", "Heron", "Lynx", "Stag", "Crane",
    "Wanderer", "Ronin", "Comet", "Ember",
]


def generate_username() -> str:
    return f"{random.choice(ADJECTIVES)}{random.choice(NOUNS)}{random.randint(10, 999)}"
