import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

export default function Home() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <div className="bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to Ticket Booking
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Book your favorite events with ease
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/events"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-lg font-semibold"
            >
              Browse Events
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="px-6 py-3 bg-white text-primary-600 rounded-lg hover:bg-gray-50 text-lg font-semibold border-2 border-primary-600"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

