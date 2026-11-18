/* These images are exported from dress() offline. Phones load only the selected
   strap; desktop keeps the original procedural generator. UV/image settings are
   stored alongside the pixels so mirrored linings retain their orientation. */
export function createStrapMapLoader(THREE, options = {}) {
  const base = options.baseUrl || new URL('./textures/straps/', document.baseURI).href;
  const fetchFile = options.fetch || globalThis.fetch.bind(globalThis);
  const loadImageTexture = options.loadTexture || (url => new THREE.TextureLoader().loadAsync(url));
  const imagePromises = new Map(), texturePromises = new Map(), prepared = new Map(), pending = new Map();
  let manifestPromise;
  const deadline = promise => new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(new Error('Strap textures took too long to load')), options.timeoutMs || 12000);
    promise.then(value => {clearTimeout(timer);resolve(value);}, error => {clearTimeout(timer);reject(error);});
  });
  async function manifest() {
    if (!manifestPromise) manifestPromise = deadline(fetchFile(new URL('manifest.json', base).href)
      .then(response => { if (!response.ok) throw new Error('Strap texture manifest could not load'); return response.json(); }))
      .catch(error => { manifestPromise = null; throw error; });
    return manifestPromise;
  }
  async function texture(description, index) {
    const id = JSON.stringify(description);
    if (!texturePromises.has(id)) texturePromises.set(id, (async () => {
      const entry = index.images[description.image];
      if (!entry) throw new Error('Strap texture image is missing from manifest');
      const url = new URL(entry.src, base).href;
      if (!imagePromises.has(url)) imagePromises.set(url, deadline(loadImageTexture(url)).catch(error => { imagePromises.delete(url); throw error; }));
      const source = await imagePromises.get(url), map = source.clone();
      for (const key of ['repeat','offset','center']) if (description[key]) map[key].set(...description[key]);
      for (const key of ['rotation','flipY','wrapS','wrapT','colorSpace','anisotropy','generateMipmaps','minFilter','magFilter'])
        if (description[key] !== undefined) map[key] = description[key];
      map.needsUpdate = true;
      return map;
    })().catch(error => { texturePromises.delete(id); throw error; }));
    return texturePromises.get(id);
  }
  async function material(description, index) {
    const values = {};
    await Promise.all(['map','normalMap','roughnessMap','sheenColorMap'].map(async key => {
      if (description[key]) values[key] = await texture(description[key], index);
    }));
    return {values, normalScale: description.normalScale};
  }
  function prepare(key) {
    if (prepared.has(key)) return Promise.resolve(true);
    if (!pending.has(key)) pending.set(key, (async () => {
      const index = await manifest(), entry = index.straps[key];
      if (!entry) return false; // the metal bracelet has no baked leather maps
      const loaded = {};
      await Promise.all(['front','back','single'].map(async role => {
        if (!entry[role]) return;
        loaded[role] = role === 'single'
          ? await material(entry[role], index)
          : await Promise.all(entry[role].map(description => material(description, index)));
      }));
      prepared.set(key, loaded);
      return true;
    })().finally(() => pending.delete(key)));
    return pending.get(key);
  }
  function apply(key, strap) {
    const maps = prepared.get(key);
    if (!maps) return false;
    const assign = (target, data) => {
      if (!target || !data) throw new Error('Baked strap material does not match the strap');
      Object.assign(target,data.values);
      if (data.normalScale) target.normalScale.set(...data.normalScale);
      target.needsUpdate = true;
    };
    if (maps.front) maps.front.forEach((data,i) => assign(strap.mats[i],data));
    if (maps.back) maps.back.forEach((data,i) => assign(strap.backs[i],data));
    if (maps.single) assign(strap.mat,maps.single);
    strap.dressed = true;
    return true;
  }
  return {prepare, apply, isPrepared: key => prepared.has(key)};
}
