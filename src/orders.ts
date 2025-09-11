// orders.ts
// Dynamically adds project cards to the orders page

type Project = {
  image: string;
  name: string;
  story: string;
};

const projects: Project[] = [
  {
    image: '/assets/Redahn.gif',
    name: 'Redahn Figurine',
    story: 'A custom figurine of Redahn from Elden Ring, made for a dedicated gamer and fan of the series. The intricate details were a challenge to capture in 3D printing.'
  },
  {
    image: '/assets/karambit.webp',
    name: 'Karambit Knife',
    story: 'A karambit knife replica from CS:GO, printed for a collector. The curved blade and ergonomic handle were designed to mimic the real thing as closely as possible.'
  },
  {
    image: '/assets/thing.png',
    name: 'Fidget thing',
    story: 'A fidget toy that helps calm the noise in everybodies head, this print was made specifally to have something to play with!'
  },
  {
    image: '/assets/aim120.png',
    name: 'Model Rocket AMRAAM',
    story: 'A scale model of the AIM-120 AMRAAM missile, printed for a local hobbyist. The challenge was getting the fins just right for aerodynamic stability.'
  },
  {
    image: '/assets/luffy.webp',
    name: 'Luffy Figurine',
    story: 'A custom One Piece figurine for an anime fan. Given to the customer that made the very first purchase and inspired the creation of this site as a whole'
  },
  {
    image: '/assets/batarang.png',
    name: 'Arkham knight batarang',
    story: 'Made for a fan of the batman series, the batarang was a dynamic print that allows the user to retract and extent the batarang whenever they need, with a sharp print, it can deal damage to anybody!'
  },
  {
    image: '/assets/Rotation.gif',
    name: 'Rotation device fidget thing',
    story: 'A weird thing that you can rotate and it acts like a chicken head like how it doesn\'t move when you move it, overall quite fun to fidget with!'
  },
  {
    image: '/assets/LavaChicken.png',
    name: 'Lava chicken song',
    story: 'Made from pure curiosity, the lava chicken music box was made, moving the knob from left to right, you can hear the very song from the minecraft movie!'
  },
];

function createProjectCard(project: Project): HTMLElement {
  const card = document.createElement('div');
  card.className = 'bg-gray-800 rounded-xl shadow-lg flex flex-col items-center p-6 hover:scale-105 transition-transform duration-200 border border-violet-400';

  const img = document.createElement('img');
  img.src = project.image;
  img.alt = project.name;
  img.className = 'w-full max-h-48 object-contain rounded-lg mb-4 bg-gray-700';

  const name = document.createElement('h3');
  name.textContent = project.name;
  name.className = 'text-xl font-bold text-violet-300 mb-2 text-center';

  const story = document.createElement('p');
  story.textContent = project.story;
  story.className = 'text-white text-base text-center';

  card.appendChild(img);
  card.appendChild(name);
  card.appendChild(story);

  return card;
}

function renderProjectsGrid() {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;
  grid.innerHTML = '';
  projects.forEach(project => {
    grid.appendChild(createProjectCard(project));
  });
}

document.addEventListener('DOMContentLoaded', renderProjectsGrid);
