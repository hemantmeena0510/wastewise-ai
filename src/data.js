const menuItems = [
  { name: 'Rajma + Rice + Roti', category: 'Main course', factor: 1.02 },
  { name: 'Paneer Bowl + Salad', category: 'Main course', factor: 1.08 },
  { name: 'Dal Khichdi + Curd', category: 'Main course', factor: 0.94 },
  { name: 'Veg Biryani + Raita', category: 'Main course', factor: 1.05 },
];

const weatherTypes = ['Sunny', 'Cloudy', 'Rainy'];

const stableHash = (value) => [...value].reduce((total, character) => total + character.charCodeAt(0), 0);

export const createDemoRecords = () => {
  const records = [];
  const today = new Date();
  const items = [
    { name: 'Rice', category: 'Grains', share: 0.38 },
    { name: 'Rajma', category: 'Main course', share: 0.34 },
    { name: 'Salad', category: 'Sides', share: 0.28 },
  ];

  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const dateString = date.toISOString().slice(0, 10);
    const weekday = date.getDay();
    const seed = stableHash(dateString);
    const attendance = 650 + ((seed * 7) % 251);
    const menu = menuItems[seed % menuItems.length].name;
    const weather = weatherTypes[seed % weatherTypes.length];
    const isHoliday = seed % 23 === 0;
    const hasEvent = seed % 11 === 0;
    const demandRate = 0.835 + (weekday === 0 || weekday === 6 ? -0.035 : 0) + (hasEvent ? 0.035 : 0) - (isHoliday ? 0.07 : 0);

    items.forEach((item, index) => {
      const variation = ((seed + index * 13) % 17) - 8;
      const prepared = Math.max(0, Math.round(attendance * item.share * 0.97 + variation));
      const consumed = Math.max(0, Math.min(prepared, Math.round(attendance * item.share * demandRate + variation / 2)));
      records.push({
        id: `${dateString}-${item.name.toLowerCase()}`,
        date: dateString,
        attendance,
        menu,
        foodItem: item.name,
        category: item.category,
        plannedQuantity: prepared,
        actualConsumption: consumed,
        leftover: prepared - consumed,
        weather,
        holiday: isHoliday,
        event: hasEvent ? 'Campus event' : '',
      });
    });
  }

  return records;
};

export const demoMenuOptions = menuItems.map(({ name }) => name);
export const demoWeatherOptions = weatherTypes;

export const getTodaySample = () => ({
  attendance: 800,
  menu: 'Rajma + Rice + Roti',
  temperature: 34,
  dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
  holiday: false,
  event: false,
  plannedProduction: 700,
});

export const demoImpact = {
  foodSavedKg: 184,
  mealsPreserved: 420,
  costSaved: 12450,
  reductionPercent: 18.4,
};
