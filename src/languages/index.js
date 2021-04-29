export const LANGUAGES = {};

export function addLanguage(languageDefinition) {
  var id = languageDefinition.id;
  if (!id) {
    throw new Error(`language definition missing an 'id' attribute`);
  }
  if (LANGUAGES[id]) {
    throw new Error(`language ${id} has already been added.`);
  }
  if (!languageDefinition.name) {
    throw new Error(`language definition for ${id} is missing a 'name' attribute.`);
  }
  if (!languageDefinition.parse) {
    throw new Error(`language definition for ${id} is missing a 'parse' function.`);
  }
  /*
  if (!languageDefinition.getParser) {
    throw new Error(`language definition for ${id} is missing a 'getParser' function.`);
  }
  let parser = languageDefinition.getParser();
  if (!(parser && typeof parser.parse == 'function')) {
    throw new Error(
      `getParser() function for language ${id} must return an object with a 'parse' function.`
    );
  }
  */

  LANGUAGES[id] = languageDefinition;
  return languageDefinition;
}

export function getLanguage(languageId) {
  if (!LANGUAGES[languageId]) {
    console.warn('Trying to get language', languageId, 'but it hasn\'t been added yet');
  }
  return LANGUAGES[languageId];
}

export function removeLanguage(languageId) {
  delete LANGUAGES[languageId];
}

export function getLanguages() {
  return Object.values(LANGUAGES);
}
