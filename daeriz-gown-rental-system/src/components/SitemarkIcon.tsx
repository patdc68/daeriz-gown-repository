import logo from '../assets/dblg.svg'; // adjust path if needed

export default function SitemarkIcon() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img
        src={logo}
        alt="Daeriz Bleau Gown Rentals Logo"
        style={{ width: '100%', height: '100%', maxHeight: 180 }}
      />
      <span
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 600,
          color: '#1976d2',
          fontSize: '1.25rem',
        }}
      >
      
      </span>
    </div>
  );
}